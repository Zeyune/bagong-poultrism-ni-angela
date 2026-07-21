-- 030_seed_reference.sql — development seed
--
-- Creates the reference data without which core features silently no-op:
--   • A Farm with timezone and currency (BR-05, BR-06)
--   • A Ross 308 growth curve — without it GET /reports/broiler-growth returns 404 (G-21)
--   • PRODUCT inventory items — without the egg item, sellable-egg posting silently
--     does nothing (I-11), and sales have no stock to draw from (G-08)
--   • Default alert settings
--
-- Idempotent: safe to re-run.
--
-- ⚠️ DEVELOPMENT DATA. Prices are placeholders. Production uses the app's
--    first-run setup flow (USER_FLOWS §2.1), not this file.

begin;

-- ── Farm ──────────────────────────────────────────────────────────────────
-- Fixed id so the rest of this file can reference it deterministically.
insert into public."Farm" (id, name, location, timezone, currency, "createdAt", "updatedAt")
values (
  'farm_dev_000000000000000',
  'PoultryPilot Dev Farm',
  'Philippines',
  'Asia/Manila',   -- authority for EVERY day boundary in the system (BR-05)
  'PHP',
  now(), now()
)
on conflict (id) do update
  set timezone = excluded.timezone,
      currency = excluded.currency;

-- ── Growth curve: Ross 308, as-hatched ────────────────────────────────────
-- ⚠️ INDICATIVE FIGURES. Replace with the official Aviagen Ross 308 performance
--    objectives before anyone makes a culling or feeding decision from this chart.
--    A target curve that is quietly wrong is worse than no curve, because the
--    report looks authoritative either way.
insert into public."GrowthCurve" (id, "farmId", name, breed, description, "createdAt", "updatedAt")
values (
  'curve_ross308_ash00000000',
  'farm_dev_000000000000000',
  'Ross 308 — as-hatched',
  'Ross 308',
  'Indicative as-hatched body weight, days 0–45. Placeholder pending official breed standard.',
  now(), now()
)
on conflict (id) do nothing;

insert into public."GrowthCurvePoint" (id, "growthCurveId", "dayOfCycle", "targetWeightG")
values
  ('gcp_r308_d00', 'curve_ross308_ash00000000',  0,   42.00),
  ('gcp_r308_d07', 'curve_ross308_ash00000000',  7,  190.00),
  ('gcp_r308_d14', 'curve_ross308_ash00000000', 14,  470.00),
  ('gcp_r308_d21', 'curve_ross308_ash00000000', 21,  950.00),
  ('gcp_r308_d28', 'curve_ross308_ash00000000', 28, 1570.00),
  ('gcp_r308_d35', 'curve_ross308_ash00000000', 35, 2280.00),
  ('gcp_r308_d42', 'curve_ross308_ash00000000', 42, 2990.00),
  ('gcp_r308_d45', 'curve_ross308_ash00000000', 45, 3290.00)
on conflict ("growthCurveId", "dayOfCycle") do nothing;

-- ── PRODUCT inventory items ───────────────────────────────────────────────
-- Stocked in the SELLING-KEEPING unit, not the sale unit. Eggs are stocked as
-- 'egg' with unitsPerPackage = 12, so a 3-dozen sale deducts 36 (BR-39). Getting
-- this backwards is how collection and sales stop reconciling.
insert into public."InventoryItem" (
  id, "farmId", name, type, unit, "unitsPerPackage",
  "currentStock", "avgUnitCost", "salePrice", "reorderThreshold", "isActive",
  "createdAt", "updatedAt"
)
values
  ('inv_product_eggs00000000', 'farm_dev_000000000000000', 'Eggs',
   'PRODUCT', 'egg',  12, 0, 0, 90.00, 0, true, now(), now()),
  ('inv_product_chicken00000', 'farm_dev_000000000000000', 'Whole Processed Chicken',
   'PRODUCT', 'bird',  1, 0, 0, 220.00, 0, true, now(), now())
on conflict (id) do nothing;

-- ── Feed items ────────────────────────────────────────────────────────────
insert into public."InventoryItem" (
  id, "farmId", name, type, unit, "unitsPerPackage",
  "currentStock", "avgUnitCost", "salePrice", "reorderThreshold", "isActive",
  "createdAt", "updatedAt"
)
values
  ('inv_feed_layer0000000000', 'farm_dev_000000000000000', 'Layer Feed 16%',
   'FEED', 'kg', null, 500.000, 32.5000, null, 100.000, true, now(), now()),
  ('inv_feed_broiler00000000', 'farm_dev_000000000000000', 'Broiler Starter',
   'FEED', 'kg', null, 300.000, 38.0000, null,  75.000, true, now(), now())
on conflict (id) do nothing;

-- ── Default alert settings ────────────────────────────────────────────────
-- farmId + null flockId = farm-wide default; per-flock rows override (BR-58).
insert into public."AlertSetting" (
  id, "farmId", "flockId", "alertType", "thresholdValue", "cooldownHours", "isActive",
  "createdAt", "updatedAt"
)
values
  ('alert_prod_drop000000000', 'farm_dev_000000000000000', null, 'PRODUCTION_DROP', 15.000, 24, true, now(), now()),
  ('alert_mortality000000000', 'farm_dev_000000000000000', null, 'MORTALITY_SPIKE',  2.000, 24, true, now(), now()),
  ('alert_low_inventory00000', 'farm_dev_000000000000000', null, 'LOW_INVENTORY',    0.000, 24, true, now(), now())
on conflict (id) do nothing;

-- ── Initial flocks (BR-03) ────────────────────────────────────────────────
-- One LAYER (50) and one BROILER (50). "Initial deployment manages one of each"
-- is seed data, not a system limit. Seeded here — before 040 attaches the audit
-- trigger — so these creations are not audited as user actions. currentCount
-- starts equal to initialCount (BR-13); the broiler carries the 45-day cycle (BR-04).
insert into public."Flock" (
  id, "farmId", type, name, breed, "initialCount", "currentCount",
  "startDate", "cycleLengthDays", status, "defaultFeedItemId",
  "createdAt", "updatedAt"
)
values
  ('flock_layer_0000000000000', 'farm_dev_000000000000000', 'LAYER', 'Layer Flock 1',
   'Lohmann Brown', 50, 50, '2026-07-01', null, 'ACTIVE', 'inv_feed_layer0000000000',
   now(), now()),
  ('flock_broiler_00000000000', 'farm_dev_000000000000000', 'BROILER', 'Broiler Flock 1',
   'Ross 308', 50, 50, '2026-07-01', 45, 'ACTIVE', 'inv_feed_broiler00000000',
   now(), now())
on conflict (id) do nothing;

commit;
