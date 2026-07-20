# GAPS.md: PoultryPilot

Issues found in the v1 specification set (`PRD.md`, `REQUIREMENTS.md`, `USER_FLOWS.md`,
`DATABASE.md`, `API.md`, `BUSINESS_RULES.md`, `DESIGN.md`, `ROADMAP.md`).

**Status key**

| | Meaning |
|:---|:---|
| ✅ | Resolved in `DATABASE.md` revision 2 |
| 🟡 | Partially resolved — schema supports it, but another document still needs updating |
| ⬜ | Open — needs a decision or a doc change |

**Severity key**

| | Meaning |
|:---|:---|
| **P0** | Blocks implementation. Work cannot start, or will produce a broken system. |
| **P1** | Correctness. The system will build but produce wrong numbers, lose data, or fail a stated requirement. |
| **P2** | Completeness. A documented feature has no specification behind it. |
| **P3** | Quality, polish, and process. |

**Counts:** 12 P0 · 21 P1 · 19 P2 · 12 P3 — 64 total.

| Revision | Closed | Running total |
|:---|:---|:---|
| `DATABASE.md` rev 2 | 23 | 23 / 64 |
| `BUSINESS_RULES.md` rev 2 + `API.md` rev 2 + `ROADMAP.md` G-12 edit | 19 | 42 / 64 |
| `USER_FLOWS.md` rev 2 | 1 | 43 / 64 |
| `REQUIREMENTS.md` rev 2 + `DESIGN.md` rev 2 + `PRD.md` FR-11–13 | 4 | 47 / 64 |
| Platform move to Vercel + Supabase | 2 (G-24, G-57) | 49 / 64 |
| Backup + keep-alive workflows | 1 (G-59) | **50 / 64** |
| Platform-move adversarial pass | **opened 12** (G-65…G-76) | 50 / 76 |
| `TESTING.md` | 1 (G-58) | 51 / 76 |
| Roadmap reconciliation (G-60; **opened + closed** G-77, G-78) | 3 | 54 / 78 |
| Step 0 scaffold (**opens** G-79) | 0 | 54 / 79 |
| Step 1 database — **G-65 verified**, G-76, G-79 (**opens** G-80) | 3 | 57 / 80 |
| Step 2 CI gates — G-71, G-72, G-80 | 3 | **60 / 80** |

**25 open.** The platform move closed two gaps and opened twelve — a net loss on count, though the
move was still correct on the merits. Two of the new ones are more serious than anything in the
original set.

Every open item now has either a specification behind it or an explicit decision to defer.
[TESTING.md](TESTING.md) maps the must-cover list onto the invariant and requirement IDs, so
"is this tested?" is a CI check rather than a judgement call.

### 🔴 Must be closed before any real data is entered

| Gap | Issue |
|:---|:---|
| **G-65** | **The Supabase Data API bypasses every access rule in this specification.** The public `anon` key can read and write all tables until RLS is enabled. |
| **G-66** | **Invitations do not work.** Supabase's default SMTP sends 2/hour and refuses non-team addresses. FR-10 fails silently until custom SMTP is configured. |

### 🟠 Must be closed before launch

| Gap | Issue |
|:---|:---|
| **G-67** | Preview deployments write to the production database. |
| **G-68** | Backups have never been restore-tested. |
| **G-56** | Online-only versus in-barn data entry — the riskiest assumption in the set. |

> **On G-24 and G-57:** both were closed by the platform move rather than by being worked on —
> `pg_cron` supplied the missing scheduler, and serverless cold starts removed the performance
> conflict. Recorded because "closed as a side effect" is worth distinguishing from "solved".
>
> **On G-59:** closed by `.github/workflows/backup.yml`, but see **G-68** — an untested backup is a
> claim, not a capability.

---

## Platform-Move Gaps (G-65 … G-76)

Found in an adversarial pass over the Vercel + Supabase migration. The move closed two gaps
(G-24, G-57) and **opened twelve**, two of them more serious than anything in the original set.
Numbered separately because they belong to the platform, not to the original specification.

### G-65 · The Supabase Data API bypasses the entire RBAC specification 🔴 **CRITICAL** ⬜
**Docs:** DATABASE.md, BUSINESS_RULES.md §2.1, API.md §2

Supabase serves every `public` table over PostgREST at `/rest/v1/`, authenticated with the `anon`
key — which is **public by design and shipped in the browser bundle**. Tables created by Prisma have
RLS **disabled** by default.

Consequence: every access rule in this specification — financial data stripped by role, Admin-only
customer records, immutable audit rows, append-only ledger — is bypassable by anyone who opens
DevTools, reads the anon key, and queries the REST endpoint directly. Deactivated users included.

This did not exist under the previous stack: Render exposed nothing but the application's own API.

**Fix:** Enable and force RLS on every table with **no policies**, and revoke `anon`/`authenticated`
grants; Prisma connects as the owner and is unaffected. Stronger option: disable the Data API
entirely. Migration and verification queries are in
[DATABASE.md § Row Level Security](DATABASE.md#-row-level-security--required-not-optional).
**This must be done before any real data is entered.**

### G-66 · Supabase's default SMTP cannot send invitations at all 🔴 **CRITICAL** ⬜
**Docs:** REQUIREMENTS.md FR-10, BUSINESS_RULES.md BR-09, USER_FLOWS.md §11.1

Supabase's built-in email service is limited to **2 messages per hour** and **refuses to deliver to
any address that is not part of the project's team**. FR-10 — invite a farm worker by email — is not
throttled, it is **non-functional**. The Admin sends an invitation, the UI reports success, and the
worker never receives anything.

**Fix:** Configure custom SMTP in Supabase (Auth → Email Settings). SendGrid is already in the stack
for alerts, so this is a configuration step, not a new dependency. Note that custom SMTP starts at
30 messages/hour until raised in the Rate Limits page.

**This is a launch prerequisite, and it fails silently** — worth an explicit test in the Phase 1
acceptance run rather than discovery by a farm worker who never got their invite.

### G-67 · Preview deployments share the production database 🟠 **HIGH** ⬜
**Docs:** ROADMAP.md, REQUIREMENTS.md §3

Vercel builds a preview deployment for every branch and pull request, and each inherits the project
environment variables — including `DATABASE_URL`. A preview running an unmerged migration, a seed
script, or a destructive test writes to **production farm data**.

**Fix:** Scope `DATABASE_URL` and `DIRECT_URL` to the Production environment only, and point Preview
at a separate Supabase project. Complicated by G-73: the free tier allows two projects total.

### G-68 · Backups are never restore-tested 🟠 **HIGH** ⬜
**Docs:** `.github/workflows/backup.yml`, REQUIREMENTS.md §2

The backup workflow verifies that the dump is readable and contains expected tables, which catches
silent failure — but **a backup that has never been restored is not a backup**. Restores fail for
reasons dumps cannot reveal: extension mismatches, role differences, `auth` schema dependencies that
`--schema=public` deliberately excludes.

**Fix:** Rehearse a restore into a scratch Supabase project before launch, and document the
procedure — including what is *not* recoverable from a `public`-only dump (auth users must be
re-invited). Repeat the rehearsal whenever the schema changes materially.

### G-69 · `pg_cron` schedules in UTC while everything else is farm-local 🟡 **MEDIUM** ⬜
**Docs:** DATABASE.md, BUSINESS_RULES.md BR-05, BR §8.2

BR-05 makes `Farm.timezone` the authority for every day boundary. `pg_cron` ignores it and runs in
UTC. A job written as `0 6 * * *` intending 6am runs at **2pm in Manila** — so the low-inventory
sweep fires mid-afternoon and the nightly reconciliation runs during working hours.

**Fix:** Cron expressions are now written in UTC with the intended local time in a mandatory comment.
They do **not** follow a `Farm.timezone` change — the one place in the system where a time is
hardcoded rather than derived.

### G-70 · Vercel Hobby is licensed for non-commercial use only 🟡 **MEDIUM** ⬜
**Docs:** REQUIREMENTS.md §3, PRD.md

Vercel's terms restrict the Hobby plan to personal, non-commercial projects. A farm paying for this
system, or a farm business depending on it operationally, is arguably commercial use — which would
require Pro at $20/month.

**Fix:** Fine for a capstone, portfolio piece, or a farm you own. Needs Pro before this is sold or
operated commercially. Flagged rather than resolved because it depends on intent only the account
holder knows.

### G-71 · Triggers and RLS live outside Prisma's migration model 🟡 **MEDIUM** ✅ *(enforced, not remembered)*

**Mitigation shipped:** CI runs `npm run db:sql` after `prisma migrate deploy`, then `test:rls`
fails the build if any `public` table lacks RLS. The lockdown is idempotent by design — it loops
over `pg_tables` — so re-running after every migration is the intended workflow rather than a risk.

This converts "remember to re-run the lockdown after adding a table" from a checklist item into a
build failure, which matters because the consequence of forgetting is a silently world-readable
table.

### G-71 *(original entry)* ⬜
**Docs:** DATABASE.md

The `auth.users` trigger, the RLS lockdown, and the `pg_cron` jobs are raw SQL. Prisma neither
manages nor recreates them. Two failure modes: `prisma migrate reset` silently drops all three, and
**every new table ships with RLS disabled** until the lockdown is re-run.

**Fix:** Commit each as a numbered SQL migration alongside the Prisma migrations, make the RLS
lockdown idempotent (it is — it loops over `pg_tables`), and re-run it after every migration that
adds a table. A CI check asserting zero rows from the `rowsecurity = false` query would make this
enforceable rather than remembered.

### G-72 · No secrets or environment inventory 🟡 **MEDIUM** ⬜
**Docs:** ROADMAP.md, REQUIREMENTS.md §3

Six secrets now exist across three platforms with no document listing them, their scope, or which
must never reach the client. The **service-role key bypasses RLS entirely** — leaking it into a
client bundle would undo G-65's fix completely and invisibly.

**Fix:** Document the inventory: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(public), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`,
`SENDGRID_API_KEY` (server-only, never `NEXT_PUBLIC_`). Add a CI grep asserting no non-public secret
appears in the client bundle.

### G-73 · Free tier allows two projects — dev and prod consume both 🟡 **MEDIUM** ⬜
**Docs:** ROADMAP.md

No staging environment is possible, and G-67's fix (a separate preview database) competes for the
same two slots.

**Fix:** Either accept dev + prod with no staging and run previews against the dev project, or use a
local Supabase instance (`supabase start`) for development and reserve the hosted projects for
preview and production.

### G-74 · No rate limiting, against a metered compute budget 🟡 **MEDIUM** ⬜
**Docs:** API.md §3.2

`429 RATE_LIMITED` is documented with no thresholds and no implementation. Vercel Hobby includes
**4 hours of Active CPU per month**. An unauthenticated endpoint hit by a crawler or a retry loop
could exhaust the month's budget and take the farm offline.

**Fix:** Rate-limit at the middleware layer, keyed by IP for unauthenticated routes and by user for
authenticated ones. Confirm the health endpoint is cheap enough to be safe when hit repeatedly.

### G-75 · Prisma's cold-start cost is unmeasured against the p95 target 🟡 **MEDIUM** ⬜
**Docs:** REQUIREMENTS.md §2

The claim that warm p95 < 200 ms is achievable rests on the workload being trivial, which it is. But
Prisma Client initialisation and engine loading add meaningfully to serverless cold starts, and that
cost has been asserted rather than measured.

**Fix:** Measure once the first endpoint exists. If cold starts are unacceptable, the mitigations are
Prisma's driver adapters, or Supabase's client for read paths.

### G-80 · Pooler-specific failures cannot reproduce locally 🟡 **MEDIUM** ✅ *(mitigated by a grep gate)*

**Mitigation shipped:** `scripts/check-no-advisory-locks.mjs`, wired into CI as
`test:no-advisory-locks`. It fails the build on any `pg_advisory_lock` /
`pg_advisory_xact_lock` / `pg_try_advisory_lock` usage outside a comment, and was verified by
introducing one.

A grep gate is the honest tool here: the hazard **cannot be reproduced where the code is written**,
because local Supabase runs no pooler. No test on a developer machine can catch it. Residual risk
remains for other session-state dependencies (prepared statements, `SET`, temp tables) — a pooled
CI connection would close that fully and is not yet configured.

### G-72 · No secrets or environment inventory ✅ *(closed — `.env.example` + `test:secrets` gate)*
**Docs:** DATABASE.md, TESTING.md, PHASE1_PLAN.md

Local Supabase does **not** start the pooler container, so `DATABASE_URL` and `DIRECT_URL` point at
the same direct connection on 54322. Every constraint that transaction-mode pooling imposes —
advisory locks silently failing, prepared statements being unavailable — is therefore **invisible in
local development**.

This is precisely the failure mode I-15 warns about: advisory locks work fine against a direct
connection and fail silently in production. Local testing would give false confidence.

**Fix:** CI must run at least one integration suite against a pooled connection, or a test must
assert that no `pg_advisory_lock` call exists in the codebase. A grep-based gate is cheap and
catches the realistic case (someone reaches for an advisory lock because it works on their machine).

### G-79 · No Docker on the development machine ✅ *(closed — Docker 29.6.2 installed and verified)*
**Docs:** TESTING.md, PHASE1_PLAN.md

Discovered during Step 0. The machine has Node 24 and npm 11 but **no Docker**, and
`supabase start` requires it. The integration-test strategy was chosen specifically so that RLS
*(G-65)* and the `auth.users` trigger *(BR-10)* would be testable — neither is testable without it.

CI is unaffected: GitHub runners provide Docker, so `supabase/setup-cli` works there.

**Fix — one of:**
1. **Install Docker Desktop.** Windows 10 Home requires the WSL 2 backend. Free, but a real setup
   step. Restores full local parity and is the only option where a developer can run the whole suite
   before pushing.
2. **Use a cloud Supabase project for development**, and run integration tests only in CI. Costs one
   of the two free-tier project slots *(G-73)* and makes the feedback loop a push away.
3. **Plain Postgres locally** (no Docker needed if installed natively) for schema and invariant work,
   accepting that RLS and trigger tests run only in CI.

**Needs a decision before Step 1.** Step 1 applies the RLS lockdown and the auth trigger, and
verifying either requires a database.

### G-76 · `User.id` generation is inconsistent between Prisma and the trigger 🟢 **LOW** ⬜
**Docs:** DATABASE.md

Prisma declares `id String @id @default(cuid())`. The provisioning trigger inserts
`gen_random_uuid()::text`. Both are strings so nothing breaks, but `User` rows will carry two
visually distinct id formats depending on whether they were created by the app or by the trigger.

**Fix:** Pick one. Simplest is `@default(uuid())` on `User` so both paths agree.

---

## P0 — Blockers

### G-01 · Prisma schema does not compile ✅
**Docs:** DATABASE.md
`User.farm` and `Farm.owner` both declared the relation name `"FarmOwner"` while pointing in
opposite directions, and `Farm.users User[]` had no matching back-relation field. Two relations,
three fields, one name — `prisma validate` fails.
**Fix:** Split into `"FarmOwner"` (Farm → owning User) and `"FarmMembers"` (Farm → member Users).

### G-02 · Circular required foreign key makes the first insert impossible ✅
**Docs:** DATABASE.md
`User.farmId` and `Farm.ownerId` were both non-nullable and referenced each other. There is no
insert order that satisfies both, and no deferred constraint was specified.
**Fix:** `Farm.ownerId` is nullable; bootstrap is Farm → User → backfill owner, in one transaction.
Documented under "Bootstrap Order".

### G-03 · Authentication specified two contradictory ways ✅
**Docs:** PRD.md, REQUIREMENTS.md, DATABASE.md, API.md
PRD and REQUIREMENTS mandate Clerk. The schema carried `password String // Hashed password`. There
was no `clerkUserId` column, so nothing mapped a Clerk identity to a `User` row.
**Fix:** Password removed and an external identity link added. Originally `clerkUserId`; after the
platform moved to Supabase it is `authUserId` → `auth.users.id`, provisioned by a Postgres trigger.
Fully closed — no webhook is needed.

### G-04 · Invitation email sender contradicts itself ✅
**Docs:** API.md:71 vs USER_FLOWS.md:136
API.md says invitations are sent "via SendGrid"; USER_FLOWS says "System (via Clerk) sends an
invitation email". These are different systems with different templates, different bounce handling,
and different failure modes.
**Fix:** Pick Clerk (it owns the invitation token). Update API.md. Reserve SendGrid for farm alerts.

### G-05 · Feed deduction has no source item ✅
**Docs:** BUSINESS_RULES.md BR-08, REQUIREMENTS.md FR-04, DATABASE.md
BR-08 required daily feed logs to "deduct from the corresponding feed inventory item." Nothing
established correspondence — `DailyLog` had no inventory FK, and `Flock` had no feed assignment.
With two feed types the system could not know what to decrement. FR-04 was unimplementable.
**Fix:** `Flock.defaultFeedItemId` + `DailyLog.feedItemId`.

### G-06 · Treatments had no quantity to deduct ✅
**Docs:** BUSINESS_RULES.md BR-09, REQUIREMENTS.md FR-04, DATABASE.md
BR-09 required deducting medication from stock. `Treatment` stored only `dosage String`. The
acceptance criterion says "after logging a treatment using 100ml of Antibiotic X, inventory
decreases by 100ml" — no field held the 100.
**Fix:** `Treatment.quantityUsed Decimal` + `unit`, separate from the free-text `dosageText`.

### G-07 · `unitCost` did not exist anywhere ✅
**Docs:** BUSINESS_RULES.md §4, PRD.md FR-06, USER_FLOWS.md:80, DATABASE.md
The Cost & Revenue report, BR-15, and all of the pricing logic depend on inventory unit cost. The
inventory form collects "Cost per Unit". The column was absent from the ERD, the table definitions,
and the Prisma model. FR-06's third report was unbuildable.
**Fix:** `InventoryItem.avgUnitCost` (weighted average) + `InventoryTransaction.unitCostAtTime`
snapshot so historical reports don't shift when prices are edited.

### G-08 · Eggs never became sellable inventory ✅
**Docs:** PRD.md FR-08, DATABASE.md
`DailyLog.eggsCollected` was an `Int` that fed nothing. `SalesOrderItem` FK'd to `InventoryItem`.
Selling "Dozen Eggs" therefore drew on stock that was never created, in units (dozens) never
reconciled against collection (eggs).
**Fix:** Invariant I-11 auto-posts `eggsCollected - crackedEggs - eggsDiscarded` as an
`IN`/`PRODUCTION` transaction; `InventoryItem.unitsPerPackage` handles eggs → dozens.

### G-09 · No broiler processing step existed in any document ✅
**Docs:** all
The 45-day cycle counts down on the dashboard and then… nothing. No entity, no flow, no endpoint
converts 50 live birds into "Whole Processed Chicken" inventory. The entire broiler half of the
product had no terminal event, and the broiler FCR could never be closed out.
**Fix:** New `ProcessingEvent` table. **Still open:** a user flow and API endpoint — see G-32, G-36.

### G-10 · Withdrawal periods recorded but never enforced ✅
**Docs:** PRD.md FR-03, BUSINESS_RULES.md, DATABASE.md
`withdrawalPeriodDays` was stored and then ignored. No rule blocked egg or meat sales during
withdrawal, no egg-discard tracking, no flock flag, no warning. That is the entire regulatory
purpose of recording it — this is a food-safety liability, not a missing nice-to-have.
**Fix:** `Treatment.withdrawalUntil`, `Flock.withdrawalUntil`, `DailyLog.eggsDiscarded`, and
invariants I-08/I-09 (sales blocked with `422 WITHDRAWAL_ACTIVE`). **Still open:** BUSINESS_RULES
needs the rule written down, and the sales UI needs the warning state.

### G-11 · Money stored as `Float` ✅
**Docs:** DATABASE.md
`totalAmount`, `unitPrice`, `subtotal` were all `Float`. Binary floating point cannot represent
currency exactly; invoice totals will disagree with the sum of their lines.
**Fix:** `Decimal @db.Decimal(12,2)` for money, `(12,4)` for unit costs, `(12,3)` for quantities.

### G-12 · Roadmap P0 depends on P1 ✅
**Docs:** ROADMAP.md:28-30 vs :36-38
P0 includes "Low Inventory warnings" and "Admin can define inventory items and reorder thresholds",
but Inventory Management itself is P1. The MVP cannot ship as scoped.
**Fix:** Move inventory CRUD + stock tracking into P0; keep automatic deduction in P1 if needed.
This also means re-baselining the Phase 1 estimate.

---

## P1 — Correctness

### G-13 · Status vocabularies disagree across three documents ✅ *(fully closed — BUSINESS_RULES rev 2)*
**Docs:** DATABASE.md vs BUSINESS_RULES.md §3 vs USER_FLOWS.md

| Entity | Schema said | BUSINESS_RULES said |
|:---|:---|:---|
| Flock | `ACTIVE/COMPLETED/ARCHIVED` | Active / Processed / Inactive |
| Sales order | `PENDING/COMPLETED/CANCELLED` | Draft / Placed / Fulfilled / Cancelled |
| Health event | *no status field at all* | Open → Resolved |

**Fix:** One vocabulary, defined in the schema. **Still open:** BUSINESS_RULES §3 must be rewritten
to match.

### G-14 · Mortality decremented nothing ✅
**Docs:** DATABASE.md, BUSINESS_RULES.md
`DailyLog.mortalityCount` never updated `Flock.currentCount` and never set a `Bird.status` to
`DECEASED`. Every metric using flock size — hen-day %, mortality rate, and the "mortality ≤ current
flock size" validation itself — was computed against a number nothing maintained.
**Fix:** Invariants I-01, I-02.

### G-15 · No attribution on any record ✅
**Docs:** DATABASE.md, BUSINESS_RULES.md §5
No `createdById` on daily logs, health logs, inventory transactions, or sales orders. This breaks
the "Farm Worker can view own created sales orders" rule outright, and leaves financial records
with no accountability.
**Fix:** `createdById` on all seven user-authored entities.

### G-16 · No audit trail ✅
**Docs:** DATABASE.md, PRD.md (Risk: Poor Data Integrity)
Daily logs are editable and drive cost reporting. There was no way to answer "who changed last
month's feed figure and when" — while "Poor Data Integrity" is named the top product risk.
**Fix:** `AuditLog` with before/after JSON.

### G-17 · Edit and delete semantics for logs undefined ✅
**Docs:** API.md:98, BUSINESS_RULES.md
`PUT /api/daily-logs/:id` can change `feedConsumedKg`. Does the inventory deduction reverse and
re-post? Never stated. Deletes weren't specified at all. Without an answer, stock silently drifts
from reality on every correction.
**Fix:** Invariant I-04 — compensating `REVERSAL` ledger entries, never mutation.
**Still open:** API.md needs the reversal behaviour and a `DELETE` endpoint documented.

### G-18 · Negative stock behaviour undefined ✅
**Docs:** BUSINESS_RULES.md §2
BR says quantity "must be a non-negative decimal", so a daily log reporting more feed than recorded
stock would fail validation. Recorded stock always drifts from the real bin; refusing to record a
mortality because the feed number is stale is a serious usability trap.
**Fix:** Invariant I-06 — consumption may go negative with a warning; sales may not.

### G-19 · No transaction or locking requirement on stock updates ✅
**Docs:** DATABASE.md, API.md
`currentStock` is a read-modify-write. Two concurrent daily logs lose an update. Five concurrent
users are in the NFRs.
**Fix:** Invariants state single-transaction semantics; `currentStock` is a projection of the ledger
with a nightly reconciliation assertion (I-05).

### G-20 · FCR is a headline metric with no definition ✅ *(fully closed — BUSINESS_RULES §9)*
**Docs:** PRD.md FR-05, API.md:137
The dashboard, two reports, and the product's core value proposition rest on FCR. No document
defines it. Broiler FCR needs a decision on whether feed eaten by birds that later died is counted
(it must be). Layer FCR as feed-per-weight-gain is meaningless — it should be feed per dozen eggs.
`mortalityRate` (daily? cumulative? rolling?) and `henDayPercentage` (denominator = `initialCount`,
`currentCount`, or hens alive at day start?) were equally undefined, and the choices change the
numbers materially.
**Fix:** All formulas specified in DATABASE.md "Derived Metrics". **Still open:** copy into
BUSINESS_RULES.md, which is where a reader will look for them.

### G-21 · Target growth curve had no source ✅
**Docs:** API.md:139, PRD.md FR-06
`GET /api/reports/broiler-growth` returns `targetWeightG` from nowhere. No breed named (Ross 308 and
Cobb 500 differ meaningfully), no table, no seed data. The Broiler Growth Curve report had no target
series to plot against.
**Fix:** `GrowthCurve` + `GrowthCurvePoint` tables, `Flock.breed`, `Flock.growthCurveId`, and a seed
requirement.

### G-22 · Production-drop alert undefined at the edges ✅ *(fully closed — BUSINESS_RULES §8.2)*
**Docs:** BUSINESS_RULES.md BR-10
"Drops >15% vs the 7-day average" says nothing about a brand-new flock, fewer than 7 days of data,
or skipped days — and doesn't say whether "production" means total or sellable (cracked excluded).
As written, day 2 of a flock's life fires an alert.
**Fix:** Minimum 4 logged days in the trailing 7 or the check is skipped; missing days excluded, not
counted as zero; "production" means sellable eggs.

### G-23 · Alerts would spam until muted ✅
**Docs:** PRD.md FR-07, DATABASE.md
No dedup, no cooldown, no history table. The low-inventory alert re-fires on every single daily log
while stock sits below threshold. The user mutes the sender in week one and FR-07 is dead.
**Fix:** `AlertEvent` with a unique `dedupeKey`, plus `AlertSetting.cooldownHours`.

### G-24 · No scheduler exists in the architecture ✅ *(closed by the Supabase move — `pg_cron`)*
**Docs:** PRD.md FR-07, ROADMAP.md, REQUIREMENTS.md §3
Low-inventory alerts need a periodic job. There is no cron, worker, or queue in the technology
stack, the hosting plan, or the roadmap. Only log-submission-triggered alerts are possible as
specified.
**Fix:** ~~Add a scheduled worker to the stack table.~~ **Closed by the platform move** — Supabase
ships `pg_cron`. The low-inventory sweep and the nightly stock reconciliation *(I-05)* are scheduled
SQL jobs. See [DATABASE.md § Supabase Integration](DATABASE.md#supabase-integration).

### G-25 · Alert scoping and thresholds were farm-wide and duplicated ✅
**Docs:** DATABASE.md, API.md:146-148
`AlertSetting` held one threshold per farm per type with a single recipient email — but production
drop and mortality are inherently per-flock, and low-inventory thresholds already live on
`InventoryItem.reorderThreshold`, making `/api/config/inventory-thresholds` a second, conflicting
mechanism for the same value.
**Fix:** Optional `AlertSetting.flockId` scoping; `AlertRecipient` table for multiple recipients;
`reorderThreshold` stays on the item and the duplicate config endpoint should be removed (G-31).

### G-26 · No timezone anywhere ✅
**Docs:** DATABASE.md, BUSINESS_RULES.md
"Today's eggs", the `@@unique([flockId, logDate])` boundary, the 24-hour mortality window, and the
7-day average are all timezone-dependent. `Farm` had no timezone field, so behaviour depended on
where the server happened to run.
**Fix:** `Farm.timezone` (IANA), documented as the authority for every day boundary.

### G-27 · No currency, no tax ✅
**Docs:** DATABASE.md, BUSINESS_RULES.md §4
Invoices with no currency. No tax or VAT anywhere, in a module that generates customer-facing
financial documents.
**Fix:** `Farm.currency`, `SalesOrder.currency`, `SalesOrder.taxAmount`. **Still open:** tax *rate*
configuration and whether prices are tax-inclusive — needs a decision.

### G-28 · Stock deduction point for sales specified three ways ✅
**Docs:** USER_FLOWS.md:331 vs BUSINESS_RULES.md §3 vs API.md:127
The flow deducts on order creation; the status table deducts on Fulfilled; the API lets you POST an
order with `status: "Completed"` directly, skipping both.
**Fix:** Deduction happens exactly once, on the transition to `FULFILLED` (I-10).

### G-29 · Sales orders referenced products by free-text string ✅
**Docs:** API.md:127
`POST /api/sales-orders` sends `{"product": "Dozen Eggs"}` — a string, not an `inventoryItemId`. No
FK can be written and no stock can be deducted.
**Fix:** `SalesOrderItem.inventoryItemId` required; `productName` retained as a denormalized
snapshot only.

### G-30 · No user-provisioning mechanism ✅ *(now a Postgres trigger, not a webhook)*
**Docs:** API.md, ROADMAP.md:73
ROADMAP lists "webhook setup" as an external dependency. API.md documents no webhook route. Without
it, users created or deleted in Clerk never appear in or leave the local `User` table.
**Fix:** ~~Document a Clerk webhook endpoint.~~ **Superseded by the platform move** — provisioning is
now a Postgres trigger on `auth.users`, which runs in the same transaction as the auth insert. No
endpoint, no signature verification, no delivery lag, and no partially-provisioned state in the
sign-in flow.

### G-31 · Duplicate and conflicting config endpoints ✅
**Docs:** API.md:146-148
`/api/config/inventory-thresholds` (GET and PUT) duplicates `PUT /api/inventory/:id`, and the PUT
takes `itemId` in the body rather than the path.
**Fix:** Delete both `/api/config/inventory-thresholds` routes.

### G-32 · Health log API contradicts the data model ✅
**Docs:** API.md:104 vs DATABASE.md
`POST /api/health-logs` embeds a single treatment inline (`treatment`, `dosage`,
`withdrawalPeriodDays`), while the schema models `HealthLog 1—N Treatment`. The API cannot express a
second treatment, and there are no treatment endpoints at all.
**Fix:** Add `POST/GET/PUT/DELETE /api/health-logs/:id/treatments`; remove the inline fields.

### G-33 · Bird status and notes fields the API sent but the schema lacked ✅ *(fully closed — API rev 2)*
**Docs:** API.md:89 vs DATABASE.md
`PUT /api/birds/:id` sends `{"status": "Healthy", "notes": "..."}`. `BirdStatus` has no `Healthy`
member and there was no `notes` column.
**Fix:** `Bird.notes` added. **Still open:** API.md must use real enum members.

---

## P2 — Completeness

| ID | Gap | Docs | Status |
|:---|:---|:---|:---|
| **G-34** | **No `401`/`403` in any status code list.** The security NFR is "RBAC enforced on all API routes" and the contract never documents an auth failure. No `409` either, though `@@unique([flockId, logDate])` makes duplicate-log conflicts routine, and no `422` or `500`. | API.md | ✅ |
| **G-35** | **No query parameters documented anywhere.** Reports take "a specified period" with no `startDate`/`endDate`. Report endpoints don't even accept a `flockId`. Pagination is defined in the response envelope but `page`/`limit` request params are never specified. | API.md | ✅ |
| **G-36** | **Missing endpoints:** no `DELETE` for daily logs, health logs, inventory, customers, or sales orders; no treatment routes; no processing-event route; no `/api/farm` routes despite USER_FLOWS §2.1 being "Farm Settings"; no `/api/reports/*` export route despite flows offering PDF/CSV download. | API.md, USER_FLOWS.md | ✅ |
| **G-37** | **Field names differ between API and DB throughout:** `initialBirdCount`/`initialCount`, `currentQuantity`/`currentStock`, `tagId`/`tag`, `averageWeightG`/`avgWeightG`, `"Layer"`/`LAYER`, `"Farm Worker"`/`FARM_WORKER`. No serialization convention is stated, so every endpoint is a guess. | API.md, DATABASE.md | ✅ |
| **G-38** | **`POST /api/inventory` omits required fields** — `type` (a required enum) and cost are absent from the request body example. | API.md:113 | ✅ |
| **G-39** | **No API versioning.** `/api/` rather than `/api/v1/`. | API.md | ✅ |
| **G-40** | **No invoice record.** PDFs generated on the fly with no invoice number, no issue date, no persisted artifact — a regenerated PDF may not match what the customer received. | DATABASE.md | ✅ |
| **G-41** | **Water consumption collected daily and used in nothing.** No metric, report, or alert. Water-intake drop is one of the earliest illness indicators in poultry — this is a missed feature as much as dead data. | all | ✅ |
| **G-42** | **No vaccination management.** The single most routine scheduled activity in poultry appears in zero documents; health logging is entirely reactive. | PRD.md, all | ⬜ |
| **G-43** | **Cost & Revenue is really "feed and meds vs. sales."** No chick purchase cost, labour, utilities, bedding, or equipment — there is no expense entity at all. Labelling the output "Net Profit" (`API.md:140`) will actively mislead the user. | PRD.md FR-06, API.md | 🟡 — renamed to `grossMargin` with a stated cost basis; no expense entity yet |
| **G-44** | **Customer PII with no retention, deletion, or export policy.** Names, emails, phone numbers, and addresses of third parties are stored with no GDPR posture. | PRD.md NFRs, REQUIREMENTS.md §2 | ⬜ |
| **G-45** | **Individual bird tracking is half-built.** Birds can be created, but mortality is flock-level so `Bird.status` never changes, there's no per-bird production data, no bird detail screen, and no delete. FR-01's acceptance criterion ("view its details") has nothing behind it. | PRD.md FR-01, USER_FLOWS.md | ⬜ |
| **G-46** | **No `onDelete` behaviour was declared on any relation.** "Archive or delete a flock" would orphan a year of logs. | DATABASE.md | ✅ |
| **G-47** | **No seed data specified.** Growth curves, `PRODUCT` inventory items, and default alert settings must exist or core features silently no-op. | DATABASE.md, ROADMAP.md | ✅ |
| **G-48** | **Missing user flows:** editing or deleting a daily log, backfilling a missed day, ending a broiler cycle, the onboarding guided tour (a stated NFR), responding to an alert, first-run empty state, the Farm Worker's restricted dashboard. Alternative/error flows are documented for exactly one of ~20 flows (login). | USER_FLOWS.md | ✅ |
| **G-49** | **No `eggsCollected <= currentCount` validation.** A hen cannot lay more than one egg per day; the constraint list omits the most obvious data-integrity check in the domain. | BUSINESS_RULES.md §2 | ✅ |
| **G-50** | **`dosage` typed as String but validated as "a positive decimal value."** | DATABASE.md vs BUSINESS_RULES.md §2 | ✅ |
| **G-51** | **`Bird.tag` globally `@unique` while the prose says "unique within its flock."** | DATABASE.md:177 vs :406 | ✅ |
| **G-52** | **No weight sample size.** A 3-bird sample and a 50-bird sample are indistinguishable in the growth report. | DATABASE.md | ✅ |

---

## P3 — Quality, Process, Product

| ID | Gap | Docs | Status |
|:---|:---|:---|:---|
| **G-53** | **The colour palette fails the accessibility standard the same document sets.** DESIGN.md promises WCAG 2.1 AA (4.5:1), then specifies `--color-accent-yellow: #FFC107` (~1.6:1 on white), `--color-accent-orange: #FF9800` (~2.2:1), and `--color-primary-green: #4CAF50` (~3.0:1). None can legally carry text. It's the stock Material palette pasted in without contrast validation. | DESIGN.md | ✅ |
| **G-54** | **DESIGN.md has no wireframes, chart specifications, chart colour palette, colourblind consideration, empty/loading/error states, mobile breakpoints, dark mode, icon set, or logo** — for a product whose stated identity is "data-rich". | DESIGN.md | ✅ — except wireframes/mockups/logo, which need a designer |
| **G-55** | **`3xl: 48px` dashboard metrics have no responsive scale** and will overflow on a phone — the stated primary field-entry device. | DESIGN.md | ✅ |
| **G-56** | **The offline decision contradicts the adoption strategy.** "Offline data entry" is Out of Scope and "reliable internet" is an assumption — while the low-adoption mitigation is "ensure the mobile web experience is excellent for quick data entry *in the field*". A poultry house is exactly where connectivity fails. This is the riskiest assumption in the set and the documents resolve it in opposite directions. | PRD.md | ⬜ |
| **G-57** | **NFR targets are unachievable on the specified hosting.** p95 < 200ms, LCP < 2.5s, and 99.5% uptime on Render/Fly hobby tiers — cold starts alone exceed the API budget by an order of magnitude. The budget constraint says the targets must move, not the hosting. | PRD.md, REQUIREMENTS.md §3 | ⬜ |
| **G-58** | **No test strategy at all** — no test plan, coverage target, QA environment, or migration strategy. ROADMAP mitigates two separate risks with "automated testing" that is never specified or scheduled. | ROADMAP.md | ✅ — [TESTING.md](TESTING.md) |
| **G-59** | **No backup, RPO, or RTO**, despite the data-integrity mitigation citing "regular data backups". No monitoring, error tracking, or rate limiting either. | PRD.md, ROADMAP.md | ⬜ |
| **G-60** | **Sales module priority contradicts itself.** P2 "Nice to Have" in the MVP list, but a Phase 3 goal and a week-14 "MVP Launch Candidate" deliverable. | ROADMAP.md | ✅ — sales stays P2; the week-14 milestone no longer claims FR-09 |
| **G-77** | **FR numbering diverged between `PRD.md` and `REQUIREMENTS.md`.** Introduced during the REQUIREMENTS rewrite: inserting FR-03 (Weight Sampling) shifted six IDs, so FR-03 through FR-09 named different capabilities in each document. `ROADMAP.md` cited PRD numbering while `TESTING.md` cited REQUIREMENTS numbering — every cross-reference was ambiguous, and a test named `FR-05.2` would have been meaningless. | PRD.md, REQUIREMENTS.md, ROADMAP.md | ✅ — reconciled onto REQUIREMENTS numbering; **FR numbers are now never reused or renumbered**, new requirements append |
| **G-78** | **FR-11, FR-12, FR-13 had no priority assignment.** Added to PRD and REQUIREMENTS without being placed in any tier, leaving withdrawal enforcement — the one safety-critical requirement — with no phase, schedule, or owner. | ROADMAP.md | ✅ — FR-13 → P0, FR-11 + FR-12 → P1 |
| **G-61** | **Schedule is optimistic with no buffer.** 2 devs, 14 weeks, for auth + flocks + logs + inventory + health + 3 reports + alerts + sales + PDF + onboarding tour + WCAG AA. No QA resource. "UI/UX Mockups" is listed as an internal dependency with no owner and no date, yet Phase 1 starts immediately. | ROADMAP.md | ⬜ |
| **G-62** | **The economics are never addressed.** A 100-bird operation grosses a few thousand a year; there is no pricing model, business model, or willingness-to-pay discussion. The system is explicitly single-tenant, so it serves one customer per deployment, and per-customer ops cost is never mentioned. The PRD also targets 50–500 birds while the capacity NFR says 1,000. | PRD.md | ⬜ |
| **G-63** | **Success metrics measure usage, not value.** "DAU: 1+" is not a metric. NPS > 40 with n=1 is statistically meaningless. Nothing measures the actual product promise — did FCR improve, did mortality fall, was a problem caught earlier? All three are derivable from data the system already collects. | PRD.md | ⬜ |
| **G-64** | **PRD risk table is malformed** — the header declares three columns (Risk, Impact, Mitigation) and every row supplies four cells. It renders incorrectly. | PRD.md:120-125 | ✅ |

---

## Recommended order of work

1. **Unblock the build** — G-01, G-02, G-03 are done. Resolve G-04 (Clerk vs SendGrid) and G-12
   (roadmap dependency inversion) before Phase 1 planning is finalised.
2. **Rewrite BUSINESS_RULES.md** against the revised schema — it carries the most contradictions
   (G-13, G-20, G-22, G-28) and it is the document engineers will treat as authoritative for logic.
3. **Rewrite API.md** — G-30 through G-39 are all API-surface issues, and the contract currently
   cannot be implemented against the schema.
4. **Decide the deferrals explicitly** — vaccination (G-42), full expense tracking (G-43), and
   individual bird tracking (G-45) are each defensible to cut, but they should be cut in writing
   rather than left half-specified.
5. **Re-baseline the roadmap and the NFRs** — G-57, G-60, G-61. The current plan commits to targets
   the chosen infrastructure cannot meet, on a schedule with no buffer.

The single item I would not defer is **G-10, withdrawal enforcement**. Everything else on this list
produces a wrong number or a delayed release; that one lets contaminated product reach a customer.
