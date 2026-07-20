#!/usr/bin/env node
/**
 * CI GATE — every invariant and requirement has a test, or a written exemption.
 *
 * This project has no global coverage percentage, deliberately: 80% line coverage
 * is achievable while withdrawal enforcement and the stock ledger go untested.
 * What matters is whether the RULES are covered, and those have stable IDs.
 *
 * RATCHET SEMANTICS — the gate fails in both directions:
 *
 *   • A non-exempt ID with no test  → coverage was removed, or a rule was added
 *                                     without one.
 *   • An exempt ID that HAS a test  → it is covered now; delete the exemption.
 *
 * The second direction is what makes this a ratchet rather than a checklist. The
 * list can only shrink, and adding to it is a visible act in review that requires
 * writing down a reason.
 *
 * Tests declare coverage in their name:
 *     it('I-01: mortality decrements currentCount in the same transaction', ...)
 *     it('FR-02.3: rejects mortality exceeding currentCount', ...)
 *
 * Ref: docs/TESTING.md §3
 */

import { readdir, readFile } from "node:fs/promises";
import process from "node:process";
import { join } from "node:path";

const EXEMPTIONS_FILE = "test-exemptions.json";
const REQUIREMENTS_DOC = "docs/REQUIREMENTS.md";
const DATABASE_DOC = "docs/DATABASE.md";
const TEST_DIRS = ["src", "tests", "scripts"];

// ── Discover what must be covered, from the specs themselves ──────────────
// Parsed rather than duplicated: a hand-maintained list would drift from the
// documents it mirrors, which is the failure mode this whole project keeps hitting.
const dbDoc = await readFile(DATABASE_DOC, "utf8");
const invariants = [...dbDoc.matchAll(/\|\s*\*\*(I-\d+)\*\*\s*\|/g)]
  .map((m) => m[1]);

const reqDoc = await readFile(REQUIREMENTS_DOC, "utf8");
const requirements = [...reqDoc.matchAll(/^### (FR-\d+):/gm)].map((m) => m[1]);

// ── Discover what is actually covered ─────────────────────────────────────
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

const covered = new Set();
let testFiles = 0;

for (const dir of TEST_DIRS) {
  for await (const file of walk(dir)) {
    if (!/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(file) && !/verify-step\d+\.mjs$/.test(file)) {
      continue;
    }
    const text = await readFile(file, "utf8");
    testFiles++;
    // Coverage must be CLAIMED, not merely mentioned. The ID has to open the
    // description and be followed by a colon:
    //     it('I-01: mortality decrements currentCount', ...)   ← counts
    //     check('seed exists (I-11 needs the egg item)', ...)  ← does not
    // Without this, a passing reference in prose silently satisfies the gate,
    // which is exactly the false confidence the gate exists to prevent.
    for (const m of text.matchAll(/["'`]\s*(I-\d+|FR-\d+)(?:\.\d+)?\s*:/g)) {
      covered.add(m[1]);
    }
  }
}

// ── Compare against the exemption list ────────────────────────────────────
const exemptions = JSON.parse(await readFile(EXEMPTIONS_FILE, "utf8"));
const exempt = new Set([
  ...Object.keys(exemptions.invariants ?? {}),
  ...Object.keys(exemptions.requirements ?? {}),
].filter((k) => !k.startsWith("$")));

const required = [...invariants, ...requirements];

const uncovered = required.filter((id) => !covered.has(id) && !exempt.has(id));
const staleExemptions = [...exempt].filter((id) => covered.has(id));

let failed = false;

if (uncovered.length > 0) {
  failed = true;
  console.error(`\n✗ ${uncovered.length} ID(s) with no test and no exemption:\n`);
  for (const id of uncovered) console.error(`    ${id}`);
  console.error(
    `\n  Either write a test naming the ID, or add it to ${EXEMPTIONS_FILE}\n` +
      "  with a reason and the step that will cover it.\n",
  );
}

if (staleExemptions.length > 0) {
  failed = true;
  console.error(`\n✗ ${staleExemptions.length} exemption(s) now covered by a test:\n`);
  for (const id of staleExemptions) console.error(`    ${id}`);
  console.error(
    `\n  Good news — delete these from ${EXEMPTIONS_FILE}. The list only shrinks.\n`,
  );
}

if (failed) process.exit(1);

console.log(
  `✓ Coverage map: ${covered.size} covered, ${exempt.size} exempt, ` +
    `${required.length} total across ${testFiles} test file(s).`,
);
