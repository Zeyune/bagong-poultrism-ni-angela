#!/usr/bin/env node
/**
 * Environment validator (G-72) — answers "are these values right?" without
 * anyone having to read them, and without printing them.
 *
 *   npm run check:env .env.cloud
 *   npm run check:env .env.local --connect     (also tests the database URLs live)
 *
 * Values are only ever reported as a fingerprint: a short prefix, the length,
 * and nothing else. That is enough to spot the realistic mistakes — a value
 * pasted into the wrong row, a placeholder left unfilled, a secret that is
 * secretly the public key — and not enough to leak the value into a terminal
 * log, a screen share, or a chat transcript.
 *
 * Shape only. It does not contact Supabase; see `--connect` below for that.
 */

import process from "node:process";
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? ".env.local";

// `npm run check:env .env.local --connect` does NOT forward --connect to argv:
// npm claims unknown -- flags as its own config and warns. It does surface them
// as npm_config_*, so honour that too — otherwise the flag silently does nothing
// and the run reports shape-only results as though they were live ones.
const wantConnect =
  process.argv.includes("--connect") ||
  ["true", "1", ""].includes(process.env.npm_config_connect ?? "false");

let raw;
try {
  raw = readFileSync(file, "utf8");
} catch {
  console.error(`✗ cannot read ${file}`);
  process.exit(1);
}

// Parse KEY="value" / KEY=value, ignoring comments and blanks.
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

let pass = 0;
let fail = 0;
let warn = 0;

function check(name, ok, detail = "") {
  if (ok) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); fail++; }
}
function caution(name, detail = "") {
  console.log(`  ! ${name}${detail ? ` — ${detail}` : ""}`);
  warn++;
}

/** Never print a value. Prefix + length is enough to diagnose, not to leak. */
function fingerprint(v) {
  if (!v) return "empty";
  const head = v.slice(0, Math.min(12, Math.floor(v.length / 3)));
  return `${head}… (${v.length} chars)`;
}

const PLACEHOLDER = /<[a-z-]+>|xxxx|your-|<ref>/i;

console.log(`\nValidating ${file}`);

// ── 1. Everything present and actually filled in ──────────────────────────
console.log("\nPresence");
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
];
for (const k of REQUIRED) {
  const v = env[k];
  if (!v) { check(`${k} is set`, false, "missing or empty"); continue; }
  if (PLACEHOLDER.test(v)) {
    check(`${k} is filled in`, false, "still contains a placeholder");
    continue;
  }
  check(`${k} is set`, true);
}

// SENDGRID is optional while alerting is unbuilt.
if (!env.SENDGRID_API_KEY || PLACEHOLDER.test(env.SENDGRID_API_KEY)) {
  caution("SENDGRID_API_KEY unset — fine until alert email is built (G-66)");
}

// ── 2. The mistake that matters most ──────────────────────────────────────
console.log("\nKey distinctness (G-72)");
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const service = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

check("service-role key is NOT the same value as the anon key",
  !(anon && service && anon === service),
  "identical — the anon key was almost certainly pasted into both rows");

// Format check, tolerant of both key systems.
const isPublishable = /^sb_publishable_/.test(anon) || /^eyJ/.test(anon);
const isSecret = /^sb_secret_/.test(service) || /^eyJ/.test(service);
check("anon key looks like a publishable/anon key", isPublishable,
  fingerprint(anon));
check("service-role key looks like a secret key", isSecret,
  service ? `${fingerprint(service)} — expected sb_secret_… or a service_role JWT` : "");

if (/^sb_publishable_/.test(service)) {
  check("service-role key is not a publishable key", false,
    "this is a PUBLIC key in a server-secret slot");
}

// Tokens are ES256-signed and verified against JWKS (decided 2026-07-21), so a
// shared secret should no longer be present anywhere. Flag it if one lingers:
// leaving it in the environment implies a verification path that no longer exists.
if (env.SUPABASE_JWT_SECRET) {
  check("SUPABASE_JWT_SECRET is absent (JWKS verification needs no shared secret)",
    false, "remove it — see API.md §2 and the 2026-07-21 changelog entry");
}

// ── 3. Nothing secret is exposed to the browser ───────────────────────────
console.log("\nClient/server boundary (G-72)");
const leaked = Object.keys(env).filter(
  (k) => k.startsWith("NEXT_PUBLIC_") &&
    /SERVICE_ROLE|JWT_SECRET|DATABASE_URL|DIRECT_URL|SENDGRID/.test(k));
check("no server secret carries a NEXT_PUBLIC_ prefix", leaked.length === 0,
  leaked.join(", "));

// ── 4. Connection topology (I-15, G-80) ───────────────────────────────────
console.log("\nConnection topology (I-15)");
const dbUrl = env.DATABASE_URL ?? "";
const directUrl = env.DIRECT_URL ?? "";

check("DATABASE_URL and DIRECT_URL are different endpoints",
  dbUrl !== "" && dbUrl !== directUrl);
check("DATABASE_URL disables prepared statements (?pgbouncer=true)",
  /[?&]pgbouncer=true\b/.test(dbUrl));
check("DATABASE_URL pins one connection per instance (connection_limit=1)",
  /[?&]connection_limit=1\b/.test(dbUrl));

if (!PLACEHOLDER.test(dbUrl) && dbUrl) {
  check("DATABASE_URL uses a pooler port (6543 cloud / 54329 local)",
    /:(6543|54329)\//.test(dbUrl), "port not recognised as a pooler");
}
if (!PLACEHOLDER.test(directUrl) && directUrl) {
  check("DIRECT_URL uses a direct port (5432 cloud / 54322 local)",
    /:(5432|54322)\//.test(directUrl), "port not recognised as direct");
  check("DIRECT_URL does NOT carry pgbouncer=true",
    !/pgbouncer=true/.test(directUrl),
    "migrations need session state the pooler discards");
}

// A password pasted verbatim from the dashboard is a common and badly-diagnosed
// failure: unencoded reserved characters truncate the URL at the parser, and
// Postgres reports it as "password authentication failed" — indistinguishable
// from simply having the wrong password.
for (const [label, url] of [["DATABASE_URL", dbUrl], ["DIRECT_URL", directUrl]]) {
  if (!url || PLACEHOLDER.test(url)) continue;
  const userinfo = /^postgresql:\/\/([^@]*)@/.exec(url)?.[1] ?? "";
  const password = userinfo.slice(userinfo.indexOf(":") + 1);
  const offenders = [...new Set(password.match(/[@/?#[\]]/g) ?? [])];
  if (offenders.length) {
    // Naming the characters is worth the sliver of information it reveals:
    // "contains one of six" sent the reader hunting, and the commonest cause by
    // far is the dashboard's [YOUR-PASSWORD] brackets being left in place.
    const bracketed = /^\[.*\]$/.test(password);
    check(`${label} password has no unencoded reserved characters`, false,
      bracketed
        ? "the password is still wrapped in [ ] — delete the square brackets, " +
          "they are part of the dashboard's placeholder, not the password"
        : `contains ${offenders.map((c) => `'${c}'`).join(", ")} — ` +
          "percent-encode (run: python scripts/encode-password.py)");
  } else if (/%[0-9a-f]{2}/i.test(password)) {
    caution(`${label} password appears percent-encoded`,
      "correct if the raw password had reserved characters; wrong if it literally contains a %");
  }
}

// The two URLs normally carry the SAME password. When one connects and the other
// fails auth, a mismatch between these two lines is the overwhelmingly likely
// cause — a paste that landed in only one line, or a typo in one. Comparing them
// here pinpoints that without printing either value, and distinguishes it from a
// genuinely wrong password (both would fail) or pooler propagation lag.
{
  const pw = (url) => {
    const ui = /^postgresql:\/\/([^@]*)@/.exec(url)?.[1] ?? "";
    return ui.slice(ui.indexOf(":") + 1);
  };
  const a = pw(dbUrl), b = pw(directUrl);
  if (a && b && !PLACEHOLDER.test(dbUrl) && !PLACEHOLDER.test(directUrl)) {
    check("DATABASE_URL and DIRECT_URL use the same password", a === b,
      a.length === b.length
        ? "same length but different contents — likely a single-character typo in one line"
        : `different lengths (${a.length} vs ${b.length}) — one line was not fully updated`);
  }
}

// Project ref consistency — a URL from one project with keys from another is
// otherwise a very confusing runtime failure.
const refFromUrl = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(
  env.NEXT_PUBLIC_SUPABASE_URL ?? "")?.[1];
if (refFromUrl && dbUrl && !PLACEHOLDER.test(dbUrl)) {
  check("DATABASE_URL points at the same project as NEXT_PUBLIC_SUPABASE_URL",
    dbUrl.includes(refFromUrl), `expected ref ${refFromUrl}`);
}

// ── 5. Optional live check ────────────────────────────────────────────────
if (wantConnect) {
  console.log("\nLive connection");
  const pg = (await import("pg")).default;
  for (const [label, url] of [["DATABASE_URL", dbUrl], ["DIRECT_URL", directUrl]]) {
    if (!url || PLACEHOLDER.test(url)) { caution(`${label} skipped — not filled in`); continue; }
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      await c.query("select 1");
      check(`${label} connects`, true);
      await c.end();
    } catch (e) {
      check(`${label} connects`, false, e.message);
    }
  }
  // Auth verification depends on this endpoint being reachable and serving an
  // asymmetric key. A project still on the legacy shared secret serves no keys
  // here, which would break requireUser() at runtime rather than at deploy.
  const jwks = `${(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}` +
    "/auth/v1/.well-known/jwks.json";
  try {
    // `connection: close` keeps undici from pooling a keep-alive socket that
    // would otherwise still be tearing down at exit.
    const res = await fetch(jwks, {
      signal: AbortSignal.timeout(15000),
      headers: { connection: "close" },
    });
    const body = await res.json();
    const keys = body.keys ?? [];
    check("JWKS endpoint serves at least one signing key", keys.length > 0,
      "none served — project may still be on the legacy shared secret");
    if (keys.length) {
      const algs = [...new Set(keys.map((k) => k.alg))].join(", ");
      check("signing key is asymmetric (ES256/RS256, not HS*)",
        keys.every((k) => /^(ES|RS|PS)/.test(k.alg ?? "")), `alg: ${algs}`);
    }
  } catch (e) {
    check("JWKS endpoint reachable", false, e.message);
  }
} else {
  console.log("\n  (re-run with --connect to test the database URLs and JWKS live)");
}

console.log(`\n${pass} passed, ${fail} failed, ${warn} to check\n`);

// Set exitCode rather than calling process.exit(): an abrupt exit while a socket
// is still closing trips a libuv assertion on Windows
// (`!(handle->flags & UV_HANDLE_CLOSING)`), which crashes AFTER the results are
// printed and can leave a misleading exit status behind. Letting the event loop
// drain gives the same status without the race.
process.exitCode = fail === 0 ? 0 : 1;
