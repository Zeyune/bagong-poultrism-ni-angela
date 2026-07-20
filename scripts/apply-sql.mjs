#!/usr/bin/env node
/**
 * Applies every .sql file in supabase/sql/ in filename order.
 *
 * Exists because psql is not a dependency of this project and requiring a native
 * Postgres client install on every dev machine is friction we do not need — the
 * `pg` driver is already present via @prisma/adapter-pg.
 *
 * Uses the DIRECT connection (5432), not the pooler: these files create triggers,
 * functions, and grants, none of which belong on a transaction-mode pooled
 * connection.
 *
 * ⚠️ Re-run after EVERY migration that adds a table. 010_rls_lockdown.sql is
 *    idempotent by design and re-applying it is the intended workflow — Prisma
 *    does not manage RLS, so a new table ships with it disabled (G-71).
 *
 *   node scripts/apply-sql.mjs            apply all
 *   node scripts/apply-sql.mjs 010        apply only files matching "010"
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local" }); // Next.js convention
loadEnv(); // fallback

const SQL_DIR = "supabase/sql";
const filter = process.argv[2];

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error(
    "DIRECT_URL is not set. It must be the direct connection (port 5432), " +
      "not the pooler — see .env.example.",
  );
  process.exit(1);
}

const files = (await readdir(SQL_DIR))
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => !filter || f.includes(filter))
  .sort();

if (files.length === 0) {
  console.error(`No .sql files matched${filter ? ` "${filter}"` : ""} in ${SQL_DIR}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

let failed = false;
for (const file of files) {
  const sql = await readFile(join(SQL_DIR, file), "utf8");
  process.stdout.write(`  ${file} ... `);
  try {
    await client.query(sql);
    console.log("ok");
  } catch (err) {
    console.log("FAILED");
    console.error(`\n${file}:\n${err.message}\n`);
    failed = true;
    break; // ordering matters — do not continue past a failure
  }
}

await client.end();

if (failed) process.exit(1);
console.log(`\nApplied ${files.length} file(s).`);
