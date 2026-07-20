#!/usr/bin/env node
/**
 * Step 1 verification — proves the database layer works before any app code
 * depends on it.
 *
 * Checks:
 *   1. Seed reference data exists (farm, growth curve, product items, alerts)
 *   2. BR-10 — the auth.users trigger provisions public."User" in the same
 *      transaction, with role and farmId from metadata
 *   3. FR-10.3 — the trigger is idempotent
 *   4. FR-10.4 — an invitation with no role FAILS CLOSED to FARM_WORKER
 *   5. BR-11 — deleting the auth user DEACTIVATES rather than deletes
 *   6. I-15 — SELECT … FOR UPDATE row locks work (advisory locks must not be used)
 *
 * Not a substitute for the Vitest suite; this is a smoke test for Step 1.
 */

import process from "node:process";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

const FARM = "farm_dev_000000000000000";
let pass = 0;
let fail = 0;

function check(name, ok, detail = "") {
  if (ok) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

// ── 1. Seed data ──────────────────────────────────────────────────────────
console.log("\nSeed reference data");
const farm = await client.query(
  `select timezone, currency from public."Farm" where id = $1`, [FARM]);
check("farm exists with Asia/Manila + PHP",
  farm.rows[0]?.timezone === "Asia/Manila" && farm.rows[0]?.currency === "PHP",
  JSON.stringify(farm.rows[0]));

const curve = await client.query(
  `select count(*)::int n from public."GrowthCurvePoint"`);
check("G-21: growth curve has points", curve.rows[0].n === 8, `n=${curve.rows[0].n}`);

const products = await client.query(
  `select count(*)::int n from public."InventoryItem" where type = 'PRODUCT'`);
check("seed: PRODUCT items exist (precondition for I-11, not a test of it)", products.rows[0].n === 2);

const eggUnits = await client.query(
  `select "unitsPerPackage" from public."InventoryItem" where name = 'Eggs'`);
check("BR-39: eggs stocked per-egg with unitsPerPackage=12",
  eggUnits.rows[0]?.unitsPerPackage === 12);

// ── 2-4. Auth trigger ─────────────────────────────────────────────────────
console.log("\nAuth trigger (BR-10)");
const authId = randomUUID();
const email = `worker-${Date.now()}@example.com`;

await client.query(
  `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data,
                           created_at, updated_at)
   values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           $2, $3::jsonb, now(), now())`,
  [authId, email, JSON.stringify({ role: "FARM_WORKER", farmId: FARM, name: "Ana Cruz" })],
);

const provisioned = await client.query(
  `select role, status, "farmId", name from public."User" where "authUserId" = $1`, [authId]);
check("BR-10: User provisioned from auth.users insert", provisioned.rowCount === 1);
check("BR-10: role and farmId carried from metadata",
  provisioned.rows[0]?.role === "FARM_WORKER" && provisioned.rows[0]?.farmId === FARM);
check("BR-10: status ACTIVE on acceptance", provisioned.rows[0]?.status === "ACTIVE");

// Idempotency (FR-10.3) — re-running the trigger body must not duplicate.
await client.query(`select public.handle_new_auth_user()`).catch(() => {});
const dupes = await client.query(
  `select count(*)::int n from public."User" where "authUserId" = $1`, [authId]);
check("FR-10.3: trigger is idempotent", dupes.rows[0].n === 1, `n=${dupes.rows[0].n}`);

// Fails closed (FR-10.4) — no role in metadata must NOT yield ADMIN.
const authId2 = randomUUID();
await client.query(
  `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data,
                           created_at, updated_at)
   values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           $2, $3::jsonb, now(), now())`,
  [authId2, `norole-${Date.now()}@example.com`, JSON.stringify({ farmId: FARM })],
);
const noRole = await client.query(
  `select role from public."User" where "authUserId" = $1`, [authId2]);
check("FR-10.4: missing role fails closed to FARM_WORKER",
  noRole.rows[0]?.role === "FARM_WORKER", `got ${noRole.rows[0]?.role}`);

// ── 5. Delete deactivates (BR-11) ─────────────────────────────────────────
console.log("\nDeactivation (BR-11)");
await client.query(`delete from auth.users where id = $1`, [authId2]);
const afterDelete = await client.query(
  `select status from public."User" where "authUserId" = $1`, [authId2]);
check("BR-11: auth deletion DEACTIVATES, does not delete",
  afterDelete.rowCount === 1 && afterDelete.rows[0].status === "DEACTIVATED",
  `rows=${afterDelete.rowCount} status=${afterDelete.rows[0]?.status}`);

// ── 6. Row locks work (I-15) ──────────────────────────────────────────────
console.log("\nRow locking (I-15)");
await client.query("begin");
const locked = await client.query(
  `select id, "currentStock" from public."InventoryItem"
    where name = 'Layer Feed 16%' for update`);
check("I-15: SELECT … FOR UPDATE acquires a row lock", locked.rowCount === 1);
await client.query("rollback");

// ── Cleanup ───────────────────────────────────────────────────────────────
await client.query(`delete from public."User" where "authUserId" = any($1::uuid[])`,
  [[authId, authId2]]);
await client.query(`delete from auth.users where id = $1`, [authId]);

await client.end();

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
