#!/usr/bin/env node
/**
 * Create a local development admin you can sign in with. LOCAL ONLY.
 *
 *   npm run dev:user
 *
 * The app sits behind Supabase Auth, and the seed creates no users (users are
 * provisioned by the BR-10 trigger from an invitation's metadata). This creates
 * one directly via the admin API with farmId + role metadata, so the trigger
 * provisions an ACTIVE ADMIN User row. Idempotent — it removes any prior dev user
 * of the same email first.
 *
 * The credentials below are throwaway and only ever valid against the local
 * Supabase stack (127.0.0.1), which holds no real data. Never use this against a
 * cloud project — it refuses to run unless the Supabase URL is localhost.
 */

import process from "node:process";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DIRECT = process.env.DIRECT_URL ?? "";
const FARM = "farm_dev_000000000000000";

// Guard: refuse to touch anything that isn't the local stack.
if (!/127\.0\.0\.1|localhost/.test(URL)) {
  console.error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not local (${URL}).`);
  process.exit(1);
}

const EMAIL = "admin@poultrypilot.local";
const PASSWORD = "poultry-dev-admin";
const NAME = "Dev Admin";

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = new pg.Client({ connectionString: DIRECT });

async function main() {
  await sql.connect();

  // Remove any prior dev user (public.User first, so re-creating the same email
  // does not collide with a stale, soft-deactivated row on the unique email).
  await sql.query(`delete from public."User" where email = $1`, [EMAIL]);
  const existing = await admin.auth.admin.listUsers();
  const prior = existing.data?.users?.find((u) => u.email === EMAIL);
  if (prior) await admin.auth.admin.deleteUser(prior.id);

  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { farmId: FARM, role: "ADMIN", name: NAME },
  });
  if (created.error) {
    console.error("Failed to create user:", created.error.message);
    process.exit(1);
  }

  const row = await sql.query(
    `select role, status from public."User" where "authUserId" = $1`,
    [created.data.user.id],
  );
  const provisioned = row.rows[0];

  console.log("\n✓ Dev admin ready. Sign in at http://localhost:3000/sign-in\n");
  console.log(`    email:    ${EMAIL}`);
  console.log(`    password: ${PASSWORD}`);
  console.log(`    role:     ${provisioned?.role}   status: ${provisioned?.status}\n`);
  console.log("  (Local only — these credentials mean nothing outside 127.0.0.1.)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
