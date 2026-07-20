#!/usr/bin/env node
/**
 * Pooler verification (G-80) — proves the local stack reproduces production's
 * connection topology, so pooler-specific failures surface where the code is
 * written rather than in production.
 *
 * Until the local Supavisor pooler was enabled, DATABASE_URL and DIRECT_URL both
 * pointed at the direct connection on 54322. Every constraint transaction-mode
 * pooling imposes was therefore invisible locally — which is precisely the
 * failure mode invariant I-15 warns about.
 *
 * Checks:
 *   1. DATABASE_URL and DIRECT_URL are genuinely different endpoints
 *   2. The pooler is reachable and proxies to the same database
 *   3. Session state does NOT survive across statements on the pooler
 *      (advisory locks, SET) — but DOES on the direct connection, which is what
 *      makes the hazard invisible without this split
 *   4. I-15's sanctioned alternative — SELECT … FOR UPDATE inside an explicit
 *      transaction — still works through the pooler
 */

import process from "node:process";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

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

const POOLED = process.env.DATABASE_URL;
const DIRECT = process.env.DIRECT_URL;

// ── 1. The two URLs must differ ───────────────────────────────────────────
console.log("\nConnection topology (G-80)");
check("DATABASE_URL and DIRECT_URL are different endpoints", POOLED !== DIRECT);
check("DATABASE_URL disables prepared statements (?pgbouncer=true)",
  /[?&]pgbouncer=true\b/.test(POOLED ?? ""), POOLED);

// ── 2. Reachability ───────────────────────────────────────────────────────
const pooled = new pg.Client({ connectionString: POOLED });
const direct = new pg.Client({ connectionString: DIRECT });
await pooled.connect();
await direct.connect();

const pooledDb = await pooled.query("select current_database() db");
const directDb = await direct.query("select current_database() db");
check("pooler is reachable and proxies to the same database",
  pooledDb.rows[0].db === directDb.rows[0].db,
  `${pooledDb.rows[0].db} vs ${directDb.rows[0].db}`);

// ── 3. Session state is not RELIABLY preserved through the pooler ─────────
// Transaction mode does not promise to discard session state — it promises you
// cannot rely on keeping it. A single idle client is handed the same backend
// every time, so a GUC, an advisory lock, or a prepared statement APPEARS to
// survive. That is the trap: the code passes locally and fails under production
// concurrency, when the backend rotates. So the check below is not "is session
// state lost" (it often isn't) but "does the backend rotate" — which is the
// property that makes relying on session state unsound.
console.log("\nTransaction-mode semantics (I-15)");

// Probed with a session GUC rather than pg_advisory_lock: the two are lost the
// same way, but a session-level advisory lock taken through the pooler is held
// by a backend we cannot address again, so it would leak until the pool
// recycled. A GUC leaks nothing.
async function sessionStateSurvives(client) {
  await client.query("set poultrypilot.probe = 'g80'");
  const r = await client.query(
    "select current_setting('poultrypilot.probe', true) v");
  return r.rows[0].v === "g80";
}

check("session state survives on a direct connection (the hazard this hides)",
  (await sessionStateSurvives(direct)) === true);
check("a single pooled client is sticky — session state APPEARS to survive, " +
  "which is why this cannot be caught without concurrency",
  (await sessionStateSurvives(pooled)) === true);

// Force rotation: more concurrent clients than the pool has server connections.
const CLIENTS = 30;
const extra = await Promise.all(
  Array.from({ length: CLIENTS }, async () => {
    const c = new pg.Client({ connectionString: POOLED });
    await c.connect();
    return c;
  }));

const backendsPerClient = extra.map(() => new Set());
for (let round = 0; round < 3; round++) {
  await Promise.all(extra.map(async (c, i) => {
    const r = await c.query("select pg_backend_pid() p");
    backendsPerClient[i].add(r.rows[0].p);
  }));
}
await Promise.all(extra.map((c) => c.end()));

const rotated = backendsPerClient.filter((s) => s.size > 1).length;
check(`under concurrency the pooler rotates backends — session state is NOT ` +
  `reliably retained (${rotated}/${CLIENTS} clients saw more than one backend)`,
  rotated > 0);

// ── 4. Row locks inside an explicit transaction still work ────────────────
// I-15's sanctioned mechanism for stock-moving writes. Transaction-scoped, so
// the pooler holds the same server connection for its duration.
await pooled.query("begin");
const locked = await pooled.query(
  `select id from public."Farm" where id = $1 for update`,
  ["farm_dev_000000000000000"]);
await pooled.query("commit");
check("I-15: SELECT … FOR UPDATE works through the pooler", locked.rowCount === 1);

await pooled.end();
await direct.end();

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
