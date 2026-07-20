-- 020_auth_trigger.sql — implements BR-10, replaces the Clerk webhook (G-30)
--
-- Supabase Auth writes to auth.users. This trigger projects that into public."User"
-- IN THE SAME TRANSACTION, so there is no window where a user is authenticated but
-- has no local row — the state that forced a "Setting up your account…" retry loop
-- into the sign-in flow under the previous Clerk design.
--
-- role and farmId travel in the invitation's raw_user_meta_data, set when the Admin
-- calls inviteUserByEmail (docs/API.md §4).
--
-- ⚠️ Re-run after `prisma migrate reset` — Prisma does not manage this (G-71).

begin;

-- ── Insert: provision the local User row ──────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm_id text;
  v_role    public."UserRole";
begin
  v_farm_id := new.raw_user_meta_data ->> 'farmId';

  -- Fail closed: an invitation without a role becomes a FARM_WORKER, never an ADMIN.
  -- (FR-10 acceptance criterion 4.)
  begin
    v_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::public."UserRole",
      'FARM_WORKER'
    );
  exception when invalid_text_representation then
    v_role := 'FARM_WORKER';
  end;

  -- No farmId means this signup is not part of an invitation flow. Skip rather than
  -- guess — a User row with the wrong farm is worse than no row, and the app surfaces
  -- the missing row as a clear error.
  if v_farm_id is null then
    raise warning 'handle_new_auth_user: no farmId in metadata for auth user %, skipping', new.id;
    return new;
  end if;

  insert into public."User" (
    id, "authUserId", email, name, role, status, "farmId", "createdAt", "updatedAt"
  )
  values (
    gen_random_uuid(),
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    v_role,
    'ACTIVE',
    v_farm_id,
    now(), now()
  )
  on conflict ("authUserId") do nothing;   -- idempotent (FR-10.3)

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ── Update: keep the projection in sync ───────────────────────────────────
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."User"
     set email       = new.email,
         name        = coalesce(
                         nullif(new.raw_user_meta_data ->> 'name', ''),
                         name
                       ),
         "updatedAt" = now()
   where "authUserId" = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_auth_user_updated();

-- ── Delete: deactivate, never delete ──────────────────────────────────────
-- BR-11: authored records must retain a valid createdById. Hard-deleting the
-- User row would orphan every daily log, health log, and audit entry they wrote.
create or replace function public.handle_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."User"
     set status      = 'DEACTIVATED',
         "updatedAt" = now()
   where "authUserId" = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_auth_user_deleted();

commit;
