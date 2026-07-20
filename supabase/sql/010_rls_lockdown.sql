-- 010_rls_lockdown.sql — CLOSES G-65
--
-- Supabase serves every table in the `public` schema over PostgREST at /rest/v1/,
-- authenticated with the `anon` key — which is PUBLIC BY DESIGN and ships in the
-- browser bundle. Tables created by Prisma have RLS DISABLED by default.
--
-- Without this file, every access rule in docs/BUSINESS_RULES.md §2.1 is bypassable:
-- open DevTools, read the anon key, query /rest/v1/Customer directly. Financial data,
-- audit rows, the lot. Deactivated users included.
--
-- This project authorizes in APPLICATION CODE, not in RLS policies. So the correct
-- posture is: enable RLS everywhere, write NO policies, and let only roles that
-- bypass RLS through (service_role, and the owner Prisma connects as).
--
-- ⚠️ RE-RUN THIS AFTER EVERY MIGRATION THAT ADDS A TABLE (G-71).
--    Prisma does not manage RLS and will not reapply it. A new table ships OPEN.
--    This script is idempotent — it loops over pg_tables, so re-running is safe
--    and is the intended usage.
--
-- Verified by: npm run test:rls  (docs/TESTING.md §3.2)

begin;

-- ── Enable + force RLS on every public table ──────────────────────────────
-- FORCE also applies RLS to the table owner, so a leaked owner credential does
-- not silently bypass it. Prisma connects as a superuser-equivalent locally and
-- as the postgres role on Supabase, both of which still bypass — that is intended,
-- since the application layer is where authorization lives.
do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like '_prisma%'   -- Prisma's migration bookkeeping
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force  row level security', t.tablename);
  end loop;
end $$;

-- ── Revoke the Data API roles outright ────────────────────────────────────
-- Belt and braces. Even if RLS were somehow disabled on a table, these roles
-- would still hold no grants.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Future tables created in this schema inherit the revocation.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Do not let anon/authenticated even see the schema.
revoke usage on schema public from anon, authenticated;

commit;

-- ── Verification ──────────────────────────────────────────────────────────
-- Must return ZERO rows. Run as part of CI (`test:rls`).
--
--   select tablename from pg_tables
--   where schemaname = 'public'
--     and tablename not like '_prisma%'
--     and rowsecurity = false;
--
-- And from a browser console against the live project, this must NOT return data:
--
--   const { data, error } = await supabase.from('Customer').select('*')
