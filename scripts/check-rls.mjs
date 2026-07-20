#!/usr/bin/env node
/**
 * CI GATE — asserts the G-65 lockdown holds.
 *
 * Supabase serves every public table over PostgREST with the anon key, which ships
 * in the browser bundle. A table without RLS is readable and writable by anyone who
 * opens DevTools. This is the single check standing between the specification's
 * access rules and them being decorative.
 *
 * It reopens silently every time a migration adds a table (G-71), which is exactly
 * why it is a gate rather than a checklist item.
 *
 * Exit 0 = every table locked down. Exit 1 = at least one is open.
 *
 * Ref: docs/TESTING.md §3.2, docs/DATABASE.md § Row Level Security
 */

import process from "node:process";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local" }); // Next.js convention
loadEnv(); // fallback

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error("DIRECT_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

// 1. Every public table must have RLS enabled.
const { rows: unprotected } = await client.query(`
  select tablename
  from pg_tables
  where schemaname = 'public'
    and tablename not like '_prisma%'
    and rowsecurity = false
  order by tablename
`);

// 2. anon / authenticated must hold no grants.
const { rows: grants } = await client.query(`
  select table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
  order by table_name, grantee
`);

await client.end();

let failed = false;

if (unprotected.length > 0) {
  failed = true;
  console.error(`\n✗ ${unprotected.length} table(s) WITHOUT row level security:\n`);
  for (const r of unprotected) console.error(`    ${r.tablename}`);
  console.error(
    "\n  These are readable and writable by anyone holding the public anon key.\n" +
      "  Fix: npm run db:sql -- 010\n",
  );
}

if (grants.length > 0) {
  failed = true;
  console.error(`\n✗ ${grants.length} grant(s) still held by anon/authenticated:\n`);
  for (const g of grants) {
    console.error(`    ${g.table_name}: ${g.grantee} has ${g.privilege_type}`);
  }
  console.error("\n  Fix: npm run db:sql -- 010\n");
}

if (failed) process.exit(1);

console.log("✓ RLS enabled and forced on every public table; no anon grants. (G-65)");
