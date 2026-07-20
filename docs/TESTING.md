# TESTING.md: PoultryPilot

> Closes **G-58**. The specification set previously mitigated two named risks with "automated
> testing" that was never specified, scheduled, or assigned.
>
> **The premise of this document:** you already have the tests. `REQUIREMENTS.md` holds 66
> Given/When/Then acceptance criteria and `DATABASE.md` holds 15 invariants, all with stable IDs.
> They are executable specifications written in prose. This document is the harness that runs them.

---

## 1. Strategy

| Layer | Tool | What it covers | Speed |
|:---|:---|:---|:---|
| **Unit** | Vitest | Pure functions: metric formulas, weighted-average costing, date/timezone maths, validation predicates | ms |
| **Integration** | Vitest + local Supabase | Route handlers against a real database — invariants, transactions, RLS, triggers. **The centre of gravity.** | seconds |
| **E2E** | Playwright | ~6 critical-path specs in a real browser | ~1 min |
| **Static** | tsc, ESLint, custom CI checks | Types, lint, secret leakage, RLS coverage | seconds |

**Vitest over Jest** — ESM-native, no transform configuration for TypeScript, and it shares Vite
config with the Next.js build. No strong argument for Jest on a greenfield 2026 project.

### Why integration is the centre of gravity

This system's risk is concentrated in **state transitions and multi-table transactions**, not in
component rendering. A mortality entry decrements a flock, moves stock, posts a ledger row, and may
fire an alert — atomically. Unit tests cannot see that. E2E can, but too slowly to run per-invariant.

Unit tests are reserved for the arithmetic — FCR, hen-day %, weighted-average cost — because those
are pure, and because a wrong formula silently produces plausible numbers, which is the worst kind
of bug this product can have.

---

## 2. Environments

### Local

```bash
supabase start                     # Postgres + auth + PostgREST + Storage, in Docker
pnpm prisma migrate deploy         # schema
psql "$DIRECT_URL" -f supabase/sql/010_rls_lockdown.sql
psql "$DIRECT_URL" -f supabase/sql/020_auth_trigger.sql
pnpm test
```

Local Supabase is used rather than a bare Postgres container specifically so that **G-65 (RLS) and
BR-10 (the provisioning trigger) are testable**. Those are the two highest-risk items in the system,
and a plain Postgres container cannot exercise either — there is no PostgREST and no `auth` schema.

### CI

```yaml
- uses: supabase/setup-cli@v1
  with: { version: latest }
- run: supabase start
- run: pnpm prisma migrate deploy
- run: pnpm db:sql          # applies every file in supabase/sql/ in order
- run: pnpm test:ci
```

### Isolation between tests

Each integration test runs inside a **transaction that is rolled back** in `afterEach`. No truncation
between tests, no cross-test leakage, no ordering dependence.

**The exception that matters:** tests for **I-04** (compensating reversals) and **I-10** (fulfil
exactly once) must assert behaviour *across* committed transactions. Those use a truncate-and-reseed
fixture instead and are marked `describe.sequential`.

---

## 3. The must-cover list

CI fails if any item below has no test referencing its ID. This is the quality gate — there is **no
global coverage percentage**, because a percentage can be satisfied while leaving withdrawal
enforcement untested.

Tests declare what they cover in the test name:

```ts
it('I-01: mortality decrements currentCount in the same transaction', …)
it('FR-02.3: rejects mortality exceeding currentCount', …)
it('BR-32: blocks fulfilment while the source flock is under withdrawal', …)
```

A CI script greps the suite for every required ID and fails on the first one missing.

### 3.1 Invariants — all 15 required

| ID | Test focus |
|:---|:---|
| I-01, I-02 | Mortality decrements `currentCount`; never negative |
| I-03 | Feed consumption emits exactly one `OUT` transaction |
| I-04 | Editing a log **reverses and re-posts**; ledger rows never mutated ⚠️ sequential |
| I-05 | `currentStock` equals the ledger sum; reconciliation detects drift |
| I-06 | Consumption may go negative with a warning; **sales may not** |
| I-07 | Weighted average recomputed on `IN`; snapshot taken on `OUT` |
| I-08 | Treatment raises `Flock.withdrawalUntil` to the max |
| I-09 | Fulfilment blocked during withdrawal |
| I-10 | Stock deducts **exactly once**; re-fulfilment is a no-op ⚠️ sequential |
| I-11 | Sellable eggs post as `IN`/`PRODUCTION` |
| I-12 | `cracked + discarded ≤ collected`; `collected ≤ currentCount` |
| I-13 | `logDate` not before `startDate`, not in the future (farm-local) |
| I-14 | Flock with logs cannot be deleted |
| I-15 | Concurrent stock writes serialise under `FOR UPDATE` |

### 3.2 Security — non-negotiable

| ID | Test focus |
|:---|:---|
| **G-65** | `select tablename from pg_tables where schemaname='public' and rowsecurity=false` returns **zero rows** |
| **G-65** | A PostgREST query with the **anon key** against `Customer`, `SalesOrder`, and `AuditLog` returns no data |
| **G-72** | No non-public secret appears in the built client bundle |
| BR-11 | A user deactivated mid-session is rejected on the **next request**, not at next sign-in |
| BR §2.1 | A `FARM_WORKER` response body contains **no** cost, price, revenue, or margin field |
| FR-13.3 | `GET /audit-logs` returns `403` for a worker |

> **The first two run on every commit.** G-65 is the gap that makes every other access rule
> decorative, and it silently reopens whenever a migration adds a table *(G-71)*.

### 3.3 Business rules with non-obvious edges

| ID | Test focus |
|:---|:---|
| BR-21, BR-63 | Backfilled logs move inventory but **fire no alerts** |
| BR §8.2 | Production drop: skipped below 4 logged days; missing days excluded, not zeroed |
| BR-24, BR-25 | Missing feed item and missing egg product both **save with a warning** |
| BR-30 | Withdrawal never lowered by a shorter treatment |
| BR-33 | Eggs laid under withdrawal do not enter sellable stock |
| BR-39 | 3 dozen deducts 36 units |
| BR-43 | Editing an item's cost does **not** change historical `costAmount` |
| BR-49 | Rounding applied per line, then summed |
| BR-10 | The `auth.users` trigger provisions a `User` in the same transaction; idempotent on re-run |
| BR-05 | A farm at UTC+8 gets its own "today", not the server's |

### 3.4 Acceptance criteria

Every numbered criterion in `REQUIREMENTS.md` FR-01…FR-13 maps to at least one integration test
named for it. 66 criteria; the gate script parses the requirement file for IDs rather than
maintaining a duplicate list.

**One criterion cannot be automated:** `FR-10.0` — that Supabase's default SMTP silently fails to
deliver to non-team addresses *(G-66)*. It requires a real mail send. It is a **manual pre-launch
check**, listed in §6.

---

## 4. E2E — critical path only

Six specs, Playwright, run against a seeded local Supabase.

| Spec | Why it exists |
|:---|:---|
| `auth.spec.ts` | Sign in, sign out, deactivated user rejected |
| `daily-log-layer.spec.ts` | The happy path. **If this breaks, the product has no purpose.** |
| `daily-log-duplicate.spec.ts` | Second submission for a date opens edit mode, never silently overwrites |
| `daily-log-warnings.spec.ts` | Negative stock **saves** and shows a warning rather than blocking |
| `dashboard.spec.ts` | Metrics render; a worker sees no financial figures |
| `invite-worker.spec.ts` | Admin invites; user appears as `INVITED` |

Run on a mobile viewport (390×844) as well as desktop. Daily entry is designed mobile-first because
it happens in a barn, and that is exactly where a layout regression would go unnoticed on a laptop.

**Not covered by E2E:** sales, invoicing, processing, reports. Those are integration-tested at the
API layer. The trade is deliberate — E2E is slow and brittle, and these flows are used weekly rather
than daily.

---

## 5. CI pipeline

```
typecheck ─┐
lint ──────┼─→ unit ─→ integration ─→ e2e ─→ gate checks
build ─────┘
```

Gate checks, all blocking:

| Check | Fails when |
|:---|:---|
| `test:coverage-map` | A required invariant, security item, or acceptance criterion has no mapped test |
| `test:rls` | Any `public` table has RLS disabled |
| `test:secrets` | A server-only secret appears in the client bundle |
| `tsc --noEmit` | Any type error |
| `prisma migrate diff` | The schema and migrations have diverged |

Target: under 5 minutes end to end. A suite slower than that stops being run.

---

## 6. Manual pre-launch checks

Things no test suite can assert. Each maps to a launch prerequisite in `ROADMAP.md`.

| # | Check | Gap |
|:---:|:---|:---|
| 1 | **Invite a real external address and confirm delivery.** Custom SMTP must be configured; the default silently drops it | G-66 |
| 2 | **Restore a backup into a scratch Supabase project.** Confirm what is lost — `auth` users are not in a `public`-only dump | G-68 |
| 3 | Query a production table with the anon key from a browser console; confirm no data returns | G-65 |
| 4 | Confirm a preview deployment cannot reach the production database | G-67 |
| 5 | Run both GitHub workflows manually; confirm green | G-59 |
| 6 | Confirm `pg_cron` jobs fire at the intended **farm-local** time, not UTC | G-69 |

> Checks 1 and 2 are the ones that fail *silently* in production. Neither is discoverable by testing
> the code — only by exercising the real service.

---

## 7. Conventions

- **Tests are written in the same pull request as the code.** Not a phase, not a follow-up ticket.
- **A bug fix starts with a failing test** that reproduces it, named for the gap or rule it violates.
- **Fixtures build valid domain objects**, not raw rows — a fixture that bypasses invariants tests
  nothing.
- **No mocked Prisma in integration tests.** Mocking the database means mocking exactly the thing
  most likely to be wrong.
- **Time is injected, never read from the system clock.** Every date-boundary rule in this system is
  farm-local; a test that passes only before 4pm UTC is worse than no test.

---

## 8. Phase 1 scope

Not everything above lands at once.

| Milestone | Testing deliverable |
|:---|:---|
| Technical foundation | Vitest + local Supabase in CI; RLS and secret gates live from the first commit |
| Core data entry | Invariants I-01…I-06, I-11…I-15; FR-01…FR-03, FR-05, FR-10 criteria; 4 of 6 E2E specs |
| Phase 2 | I-07…I-10 (costing, withdrawal, fulfilment); FR-04, FR-06…FR-09 |

The two security gates (`test:rls`, `test:secrets`) are the **first** thing built, before any feature
work. They are cheap, and G-65 reopens silently every time a migration adds a table.

---

## Open Items

| Gap | Issue |
|:---|:---|
| **G-74** | No rate limiting exists to test yet. |
| **G-75** | Prisma cold-start cost is asserted, not measured. Add a timing check once the first endpoint exists. |
| — | No load or performance testing. At 5 concurrent users this is hard to justify; revisit if scope grows. |
| — | No accessibility test automation wired up yet — `axe-core` in CI is specified in [DESIGN.md §9.1](DESIGN.md) but not scheduled here. |
