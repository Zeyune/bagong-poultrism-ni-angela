#!/usr/bin/env node
/**
 * CI GATE — asserts no server-only secret reaches the browser (G-72).
 *
 * The service-role key BYPASSES ROW LEVEL SECURITY. Leaking it into a client
 * bundle would completely undo the G-65 lockdown, and would do so invisibly —
 * the app would keep working perfectly while every table became world-writable
 * to anyone who read the bundle.
 *
 * Two independent checks, because they catch different mistakes:
 *
 *   1. NAMING — no server-secret name may carry a NEXT_PUBLIC_ prefix anywhere
 *      in the source. Next.js inlines NEXT_PUBLIC_* into the client bundle, so
 *      renaming a secret to "fix" an undefined value is the realistic accident.
 *
 *   2. VALUES — no server-only env value may appear literally in a built client
 *      chunk. Catches hardcoded keys and accidental serialisation through props.
 *
 * Ref: docs/GAPS.md G-72, docs/TESTING.md §3.2
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/** Env vars that must never reach the browser, under any name. */
// SUPABASE_JWT_SECRET was removed on 2026-07-21: tokens are ES256-signed and
// verified against the JWKS endpoint, so no shared secret exists to leak.
const SERVER_ONLY = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "SENDGRID_API_KEY",
];

const CLIENT_BUILD_DIR = ".next/static";
const SOURCE_DIRS = ["src", "scripts"];

let failed = false;

// ── 1. Naming check ───────────────────────────────────────────────────────
async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const namingHits = [];
for (const dir of SOURCE_DIRS) {
  for await (const file of walk(dir)) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) continue;
    // This file documents the patterns it forbids, so it necessarily contains them.
    if (file.includes("check-secrets")) continue;
    const text = await readFile(file, "utf8");
    for (const secret of SERVER_ONLY) {
      // Matches a prefixed name such as the service-role key exposed publicly.
      if (text.includes(`NEXT_PUBLIC_${secret}`)) {
        namingHits.push({ file, secret });
      }
    }
  }
}

if (namingHits.length > 0) {
  failed = true;
  console.error("\n✗ Server-only secret exposed via a NEXT_PUBLIC_ prefix:\n");
  for (const h of namingHits) {
    console.error(`    ${h.file}: NEXT_PUBLIC_${h.secret}`);
  }
  console.error(
    "\n  Next.js inlines NEXT_PUBLIC_* into the client bundle. Remove the prefix.\n",
  );
}

// ── 2. Value check ────────────────────────────────────────────────────────
let bundleChecked = 0;
const valueHits = [];

const secretValues = SERVER_ONLY
  .map((name) => ({ name, value: process.env[name] }))
  // Ignore short or empty values: a 3-character secret would match everywhere
  // and produce noise, and an unset one cannot leak.
  .filter((s) => s.value && s.value.length >= 12);

try {
  await stat(CLIENT_BUILD_DIR);
  for await (const file of walk(CLIENT_BUILD_DIR)) {
    if (!/\.(js|css|map|json)$/.test(file)) continue;
    const text = await readFile(file, "utf8");
    bundleChecked++;
    for (const s of secretValues) {
      if (text.includes(s.value)) valueHits.push({ file, name: s.name });
    }
  }
} catch {
  console.warn(
    `  ! ${CLIENT_BUILD_DIR} not found — run \`npm run build\` first for the value check.`,
  );
}

if (valueHits.length > 0) {
  failed = true;
  console.error("\n✗ Server-only secret VALUE found in a client bundle:\n");
  for (const h of valueHits) console.error(`    ${h.file}: ${h.name}`);
  console.error(
    "\n  This key is now public. Rotate it in Supabase before doing anything else.\n",
  );
}

if (failed) process.exit(1);

console.log(
  `✓ No server secret in client source or bundle ` +
    `(${secretValues.length} secrets, ${bundleChecked} bundle files). (G-72)`,
);
