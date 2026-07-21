-- 040_audit_trigger.sql — implements FR-13 / BR-64 / BR-65, the audit trail.
--
-- A single AFTER INSERT/UPDATE/DELETE trigger on each audited table writes an
-- AuditLog row IN THE SAME TRANSACTION as the change. Because it is a database
-- trigger it is atomic and unbypassable — a write cannot succeed without its
-- audit row, and even raw SQL is captured (BR-64). Per-row firing means bulk
-- updateMany/deleteMany are audited one row each, for free.
--
-- The actor travels in two transaction-local GUCs, set by the app's audit
-- extension (src/lib/db.ts) from the authenticated request:
--   app.user_id  — the acting User.id (uuid), or unset for system/seed writes
--   app.farm_id  — the acting user's farmId
-- Transaction-local (set_config(..., true)) is required: the transaction-mode
-- pooler does not preserve session state across statements, but a GUC set inside
-- an interactive transaction is visible to the trigger firing in that same
-- transaction. See invariant I-15.
--
-- ⚠️ Re-run after any migration that ADDS a business table — like the RLS
--    lockdown, Prisma does not manage this (G-71). New tables are not audited
--    until their trigger exists.

begin;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer            -- runs as owner (postgres, BYPASSRLS) to write AuditLog
set search_path = public
as $$
declare
  v_action  public."AuditAction";
  v_user_id uuid;
  v_farm_id text;
  v_before  jsonb;
  v_after   jsonb;
  v_row     jsonb;
begin
  if TG_OP = 'INSERT' then
    v_action := 'CREATE'; v_before := null;              v_after := to_jsonb(NEW); v_row := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_action := 'UPDATE'; v_before := to_jsonb(OLD);     v_after := to_jsonb(NEW); v_row := to_jsonb(NEW);
  else
    v_action := 'DELETE'; v_before := to_jsonb(OLD);     v_after := null;          v_row := to_jsonb(OLD);
  end if;

  -- Actor from the transaction-local GUC. Null for writes with no request
  -- context (seeds, direct SQL) — the row is still audited, just without an actor.
  begin
    v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
  exception when others then
    v_user_id := null;
  end;

  -- farmId: the GUC first (always set by the app), then the row's own farmId,
  -- then the Farm table's id. A context-less write to a farm-less table (e.g. a
  -- DailyLog) leaves this null and fails the NOT NULL — deliberately loud, since
  -- every such write should carry request context.
  v_farm_id := nullif(current_setting('app.farm_id', true), '');
  if v_farm_id is null then
    if TG_TABLE_NAME = 'Farm' then
      v_farm_id := v_row ->> 'id';
    else
      v_farm_id := v_row ->> 'farmId';
    end if;
  end if;

  insert into public."AuditLog" (
    id, "farmId", "userId", action, "entityType", "entityId", before, after, "createdAt"
  )
  values (
    gen_random_uuid()::text,          -- AuditLog rows are trigger-created only
    v_farm_id,
    v_user_id,
    v_action,
    TG_TABLE_NAME,
    coalesce(v_row ->> 'id', ''),
    v_before,
    v_after,
    now()
  );

  return null;  -- AFTER trigger; return value is ignored
end;
$$;

-- Attach to the Phase 1 business tables that exist. AuditLog itself is excluded
-- (no self-audit), as are reference tables seeded without request context
-- (GrowthCurve, GrowthCurvePoint) whose inserts carry no farmId GUC.
do $$
declare
  t text;
  audited text[] := array[
    'User', 'Farm', 'Flock', 'Bird',
    'DailyLog', 'WeightRecord', 'InventoryItem', 'InventoryTransaction'
  ];
begin
  foreach t in array audited loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('drop trigger if exists audit_trig on public.%I', t);
      execute format(
        'create trigger audit_trig after insert or update or delete on public.%I ' ||
        'for each row execute function public.audit_row_change()', t);
    end if;
  end loop;
end $$;

commit;
