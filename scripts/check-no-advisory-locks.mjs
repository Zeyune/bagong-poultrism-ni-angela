#!/usr/bin/env node
/**
 * CI GATE — asserts no advisory locks (G-80, invariant I-15).
 *
 * Why this gate exists rather than a test:
 *
 * Supabase's transaction-mode pooler does NOT preserve session state. Advisory
 * locks are session-scoped, so they are silently released at the transaction
 * boundary — the lock call succeeds, returns true, and protects nothing.
 *
 * Local Supabase starts no pooler, so DATABASE_URL and DIRECT_URL point at the
 * same direct connection. Advisory locks therefore WORK PERFECTLY in local
 * development and in any test running against the local stack. There is no test
 * that can catch this on a developer machine — the failure only appears in
 * production, silently, as lost updates to stock levels.
 *
 * A grep gate is the honest tool for a hazard that cannot be reproduced where
 * the code is written.
 *
 * Correct alternative: SELECT … FOR UPDATE inside a Prisma interactive
 * transaction. Transaction-scoped, survives the pooler. See docs/DATABASE.md
 * § What transaction mode costs.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const SEARCH_DIRS = ["src", "prisma", "supabase/sql", "scripts"];

const FORBIDDEN = [
  { pattern: /pg_advisory_lock\b/, name: "pg_advisory_lock" },
  { pattern: /pg_advisory_xact_lock\b/, name: "pg_advisory_xact_lock" },
  { pattern: /pg_try_advisory_lock\b/, name: "pg_try_advisory_lock" },
  { pattern: /pg_advisory_unlock\b/, name: "pg_advisory_unlock" },
];

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

const hits = [];
let scanned = 0;

for (const dir of SEARCH_DIRS) {
  for await (const file of walk(dir)) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|sql|prisma)$/.test(file)) continue;
    // This file necessarily contains the strings it forbids.
    if (file.includes("check-no-advisory-locks")) continue;
    const text = await readFile(file, "utf8");
    scanned++;
    text.split("\n").forEach((line, i) => {
      // Allow deliberate mentions in comments explaining why they are banned.
      const isComment = /^\s*(\/\/|--|\*|\/\*)/.test(line);
      if (isComment) return;
      for (const f of FORBIDDEN) {
        if (f.pattern.test(line)) {
          hits.push({ file, line: i + 1, name: f.name, text: line.trim() });
        }
      }
    });
  }
}

if (hits.length > 0) {
  console.error("\n✗ Advisory lock usage found — these do not survive the pooler:\n");
  for (const h of hits) {
    console.error(`    ${h.file}:${h.line}  ${h.name}`);
    console.error(`      ${h.text.slice(0, 100)}`);
  }
  console.error(
    "\n  Advisory locks are session-scoped. Supabase's transaction-mode pooler\n" +
      "  releases them at the transaction boundary, so they protect nothing in\n" +
      "  production — while working perfectly on your machine (G-80).\n" +
      "\n  Use SELECT … FOR UPDATE inside a Prisma interactive transaction (I-15).\n",
  );
  process.exit(1);
}

console.log(`✓ No advisory locks in ${scanned} files. (G-80, I-15)`);
