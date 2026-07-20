# PHASE1_PLAN.md: P0 / Launch MVP

> Implementation plan for **P0 — Must Have (Launch MVP)**, corresponding to Phase 1 of
> [ROADMAP.md](ROADMAP.md). Target: 5–7 weeks, 2 developers.
>
> **Scope:** FR-01 (flocks), FR-02 (daily logs), FR-03 (weight sampling), FR-05 (inventory basics),
> FR-06 (core dashboard), FR-10 (auth + admin), FR-13 (audit trail).
>
> **Not in scope:** health and treatment (FR-04), withdrawal enforcement (FR-12), processing
> (FR-11), inventory automation, reports (FR-07), alerts (FR-08), sales (FR-09).

---

## How to read this

Each step lists **what to build**, **done when**, and **tests required**. A step is not complete
until its tests pass in CI — see [TESTING.md](TESTING.md).

Steps 0–2 are **infrastructure and have no user-visible output**. Resist compressing them: they
carry the RLS lockdown and the secret gate, and both silently reopen later if skipped now.

---

## Step 0 · Scaffold and validate the schema ✅ **COMPLETE**
**Estimated: ~2 days · Actual: ~1 day · blocks everything**

> **Outcome:** the schema is **valid** — all 20 models, the self-referencing `TxnReversal` relation,
> and the `FarmOwner`/`FarmMembers` pair all pass. The predicted risk did not materialise.
>
> **What did surface:**
> - **Prisma 7 changed the datasource model.** `url`/`directUrl` moved out of `schema.prisma` into
>   `prisma.config.ts`, and `PrismaClient` now requires a driver adapter. Adopted rather than pinning
>   to v6 — `@prisma/adapter-pg` drops the Rust engine for `node-pg`, which reduces cold start
>   *(improves G-75)*. Reversible: pinning to v6 is a small change if preferred.
> - **npm, not pnpm** — pnpm is not installed on this machine and npm 11.11 is.
> - 🟠 **No Docker** *(G-79)* — `supabase start` cannot run locally. **Blocks Step 1.**
>
> Delivered: `package.json`, `src/`, `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/db.ts`,
> `.env.example`. `prisma validate`, `prisma generate`, `tsc --noEmit`, and `npm run build` all pass.

The Prisma schema in [DATABASE.md](DATABASE.md) has **never been run through `prisma validate`** —
there is no Node project in this repository. It is reviewed by eye only. Expect errors.

**Build**
```
pnpm create next-app@latest . --typescript --app --tailwind --eslint
pnpm add -D prisma vitest @vitest/coverage-v8
pnpm add @prisma/client @supabase/supabase-js @supabase/ssr zod
pnpm dlx supabase init
```
- Copy the schema from `DATABASE.md` into `prisma/schema.prisma`.
- `.env.example` with all six variables *(G-72)*: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
  `DATABASE_URL` (pooler, 6543), `DIRECT_URL` (direct, 5432).

**Done when**
- `pnpm prisma validate` passes.
- `supabase start` runs locally and `prisma migrate dev` applies cleanly.
- `pnpm build` succeeds.

**Risk:** the self-referencing `InventoryTransaction.reversalOf` relation and the `FarmOwner` /
`FarmMembers` relation pair are the two most likely to fail validation. Both were hand-checked, not
tool-checked. **Fix the schema and log the change; do not work around it in application code.**

---

## Step 1 · Database: RLS, trigger, seed ✅ **COMPLETE**
**Estimated: ~2 days · Actual: ~half a day · depends on Step 0**

> **G-65 is closed and empirically verified** — not just "the query returns zero rows", but a real
> PostgREST request with the public anon key against `Farm`, `InventoryItem`, and `Customer`
> returning **`401` on all three**.
>
> All 11 Step 1 checks pass (`node scripts/verify-step1.mjs`): seed data, trigger provisioning,
> idempotency, fail-closed role defaulting, deactivate-not-delete, and `SELECT … FOR UPDATE`.
>
> **What surfaced:**
> - **Supabase's analytics container cannot start on Windows** without exposing the Docker daemon on
>   `tcp://localhost:2375`. Disabled it in `config.toml` rather than opening an unauthenticated
>   socket — it only powers local Studio's log viewer.
> - **`dotenv` reads `.env`, Next.js reads `.env.local`.** Tooling now loads `.env.local` first.
> - **Local Supabase runs no pooler**, so `DATABASE_URL` and `DIRECT_URL` are identical locally.
>   Pooler-specific failures — advisory locks, prepared statements — **will not reproduce here**
>   *(I-15)*. That gap is real and belongs in CI against a pooled connection.

**Build** — `supabase/sql/`, applied in numbered order after every migration:

| File | Contents |
|:---|:---|
| `010_rls_lockdown.sql` | Enable + force RLS on every `public` table, revoke `anon`/`authenticated`. Idempotent — loops over `pg_tables` |
| `020_auth_trigger.sql` | `handle_new_auth_user()` + trigger on `auth.users` |
| `030_seed_reference.sql` | Growth curve (Ross 308, 0–45d), `PRODUCT` items for eggs and processed chicken |

Plus `pnpm db:sql` to apply them in order, and a seed script creating the farm with `timezone` and
`currency`, then the first Admin *(see the bootstrap order in `DATABASE.md`)*.

**Done when**
- `select tablename from pg_tables where schemaname='public' and rowsecurity=false` → **zero rows**.
- A signup against local Supabase produces a `public.User` row with the right `role` and `farmId`.
- Re-running the trigger for the same `authUserId` inserts nothing (idempotent).

**Tests:** G-65 (RLS on all tables), G-65 (anon key returns no data from `Customer`), BR-10 (trigger
provisions in-transaction, idempotent).

---

## Step 2 · CI with both security gates ✅ **COMPLETE**
**Estimated: ~1 day · Actual: ~0.5 day · depends on Step 1 · built before any feature**

> **Every gate was proven by breaking it.** A gate that has never been seen to fail is an
> assumption, not a control:
>
> | Break introduced | Gate | Result |
> |:---|:---|:---|
> | `alter table "Customer" disable row level security` | `test:rls` | ✓ exit 1 |
> | `process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | `test:secrets` | ✓ exit 1 |
> | `select pg_advisory_lock(1)` | `test:no-advisory-locks` | ✓ exit 1 |
> | Test added for an exempt ID | `test:coverage-map` | ✓ exit 1 |
> | Exemption removed with no test | `test:coverage-map` | ✓ exit 1 |
>
> All four return to green afterwards.
>
> **What surfaced:**
> - **Both self-detecting scripts flagged themselves.** `check-secrets.mjs` contained
>   `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` in an explanatory comment. Excluded, as
>   `check-no-advisory-locks.mjs` already was.
> - **The coverage gate initially counted incidental mentions.** A check labelled
>   *"PRODUCT items exist (I-11 needs the egg item)"* was credited as covering I-11, which it does
>   not. Tightened so an ID counts only when it **opens** the description followed by a colon —
>   coverage must be claimed, not alluded to.
> - The ratchet has already shrunk once: `FR-10` moved off the exempt list when `verify-step1.mjs`
>   was relabelled to claim what it genuinely tests.

**Build** — `.github/workflows/ci.yml`: typecheck, lint, build, unit, integration (with
`supabase/setup-cli`), plus:

| Gate | Fails when |
|:---|:---|
| `test:rls` | Any `public` table has RLS disabled |
| `test:secrets` | A non-`NEXT_PUBLIC_` secret appears in the client bundle |
| `test:coverage-map` | A required invariant or acceptance criterion has no mapped test |
| `prisma migrate diff` | Schema and migrations have diverged |

**Done when** all four gates run on every PR and a deliberately-broken commit fails each one.

> **Why before features:** `test:rls` is the only thing standing between you and G-65, and RLS
> reopens silently every time a migration adds a table *(G-71)*. A gate added later protects nothing
> retroactively. It is roughly an hour of work.

---

## Step 3 · Auth and session (FR-10, part 1)
**~4 days**

**Build**
- Supabase Auth sign-in/out; `middleware.ts` refreshing the session.
- `lib/auth/requireUser()` — verifies the JWT, loads `User` by `authUserId`, **rejects unless
  `status = ACTIVE`, on every request** *(BR-11)*.
- `lib/auth/requireAdmin()`.
- `GET /api/v1/users/me`, `GET /api/v1/health` *(the keep-alive workflow depends on this — it must
  touch the database, not just return 200)*.
- Error envelope and the `warnings` array from [API.md §3](API.md).

**Done when** a worker signing in reaches the dashboard; a deactivated user gets `403` on their
**next request**, without needing to sign out.

**Tests:** FR-10.7 (deactivated mid-session → `403`), BR-11, API envelope shape.

---

## Step 4 · Audit trail (FR-13)
**~2 days · build before the write endpoints**

**Build** — a Prisma client extension writing `AuditLog` on every create/update/delete, capturing
actor, entity, and before/after JSON. Plus `GET /api/v1/audit-logs`, Admin-only.

**Done when** every mutation produces an audit row automatically, with no per-endpoint code.

**Tests:** FR-13.1–13.4.

> **Placed here deliberately.** As a Prisma extension it costs two days now and applies to every
> endpoint written afterwards. Added after the endpoints exist, it means revisiting each one — and
> every change made before that point is permanently unattributable, because the history was never
> recorded.

---

## Step 5 · Flocks and birds (FR-01)
**~4 days**

**Build** — `POST/GET/PATCH /api/v1/flocks`, `POST /api/v1/flocks/:id/status`, birds sub-resource.
Flock list and detail UI, create form, status change with consequence-naming confirmation.

**Done when** an Admin can create both flocks, change status through valid transitions only, and
archive rather than delete.

**Tests:** FR-01.1–01.6, I-14 (flock with logs cannot be deleted).

---

## Step 6 · Daily logs and weight sampling (FR-02, FR-03)
**~8 days · the core of the product**

**Build**
- `POST/GET/PATCH/DELETE /api/v1/flocks/:id/daily-logs`, weight-records sub-resource.
- One transaction: validate → `SELECT … FOR UPDATE` on the flock → insert → decrement
  `currentCount` → audit *(I-15; **no advisory locks** — they do not survive the pooler)*.
- Mobile-first entry form, `text-base` minimum on inputs (iOS zooms below 16px).
- Duplicate date → **edit mode, pre-filled**, never a silent overwrite.
- Backfill from the dashboard's missing-days prompt.
- Warnings surfaced as dismissible toasts after a successful save — **never as errors**.

**Done when** a full day's logging for both flocks takes under 2 minutes on a phone.

**Tests:** FR-02.1–02.9, FR-03.1–03.4, I-01, I-02, I-12, I-13, I-04 *(sequential)*.

> **The three "saves with a warning" paths are the highest-risk thing in this step.** No feed item,
> feed exceeding stock, no egg product — all must **save**. Implementing them as blocking errors
> would mean refusing to record a bird's death because feed bookkeeping is stale, which makes the
> system worse than the paper it replaces. Test them explicitly.

---

## Step 7 · Inventory basics (FR-05, FR-10 part 2)
**~5 days**

**Build** — inventory CRUD, `POST /api/v1/inventory/:id/transactions` for manual adjustment,
ledger view, deactivate-not-delete. Costs hidden from workers *(BR §2.1)*.

**No automatic deduction in Phase 1** — that is P1 *(G-12)*. `DailyLog.feedItemId` is stored but
emits no transaction yet.

**Done when** an Admin can create feed items with thresholds and record a delivery; a worker sees
stock levels but no costs.

**Tests:** FR-05.1–05.7 (excluding auto-deduction), I-07 (weighted average), BR §2.1 (worker
response contains no cost field).

---

## Step 8 · Core dashboard (FR-06)
**~5 days**

**Build** — `GET /api/v1/dashboard/metrics` returning **per-flock** cards, with financial fields
stripped by role at the query layer. Today's eggs vs. 7-day average, mortality, low stock,
missing-log prompts. Empty, loading (skeletons), and error states from [DESIGN.md §7.1](DESIGN.md).

**Not in Phase 1:** FCR and days-to-processing need weight records and cycle logic — P1.

**Done when** a farmer can tell in five seconds whether anything needs attention.

**Tests:** FR-06.1, 06.4–06.7. Metrics not yet computable render "—", never `0`.

---

## Step 9 · Hardening and launch checks
**~4 days**

Accessibility pass (`axe-core` in CI, keyboard, screen reader on daily entry), the six **manual
pre-launch checks** from [TESTING.md §6](TESTING.md), and both GitHub workflows run manually with
secrets set.

**Cannot ship until all six pass.** Two fail silently and are invisible to any automated test:
- **Invite a real external address and confirm delivery** — Supabase's default SMTP sends 2/hour and
  refuses non-team addresses, so invitations fail while reporting success *(G-66)*.
- **Restore a backup into a scratch project** — an untested backup is a claim, not a capability
  *(G-68)*.

---

## Sequence and parallelism

```
Step 0 ─ Step 1 ─ Step 2 ─┬─ Step 3 ─ Step 4 ─┬─ Step 5 ─ Step 6 ─┬─ Step 8 ─ Step 9
                          │                   └─ Step 7 ──────────┘
                          └─ (UI shell, design tokens, in parallel)
```

Steps 5/6 and 7 can run in parallel across two developers once Step 4 lands. Step 8 needs both.

| Step | Est. days | Actual | Cumulative (est.) |
|:---|---:|---:|---:|
| 0 Scaffold | 2 | **1** ✅ | 2 |
| 1 Database | 2 | **0.5** ✅ | 4 |
| 2 CI gates | 1 | **0.5** ✅ | 5 |
| 3 Auth | 4 | 9 |
| 4 Audit | 2 | 11 |
| 5 Flocks | 4 | 15 |
| 6 Daily logs | 8 | 23 |
| 7 Inventory | 5 | 23 *(parallel)* |
| 8 Dashboard | 5 | 28 |
| 9 Hardening | 4 | 32 |

**~32 working days ≈ 6.5 weeks** with two developers overlapping steps 6 and 7. Consistent with the
5–7 week estimate, with no buffer — see the risks below.

---

## Risks

| Risk | Likelihood | Mitigation |
|:---|:---|:---|
| **Schema fails `prisma validate`** | Medium | It has never been tool-checked. Step 0 exists to find out on day one rather than week three. |
| **Pooler breaks interactive transactions** | Medium | Verify a `FOR UPDATE` transaction through port 6543 during Step 1, not during Step 6 when the daily-log path depends on it. |
| **Step 6 overruns** | High | It is a third of the plan and the product's core. Cut the backfill UI to an API-only capability before cutting validation or the warning paths. |
| **No buffer in the estimate** | High | 32 days assumes nothing goes wrong. Treat 7 weeks as the realistic figure and Step 9 as compressible only at the cost of the launch checks — which is not a real option. |
| **Design has no mockups** | Medium | `DESIGN.md` specifies tokens, states, and breakpoints but draws no screens. Either accept developer-designed layouts or budget design time not currently in the plan. |

---

## Definition of done for P0

- [ ] All P0 acceptance criteria pass (FR-01, 02, 03, 05, 06, 10, 13)
- [ ] Invariants I-01, I-02, I-04, I-07, I-12, I-13, I-14, I-15 covered
- [ ] `test:rls` green — no `public` table without RLS
- [ ] `test:secrets` green — no server secret in the client bundle
- [ ] Custom SMTP configured and a **real external invitation received** *(G-66)*
- [ ] A backup **restored** into a scratch project, with losses documented *(G-68)*
- [ ] Preview deployments cannot reach the production database *(G-67)*
- [ ] Both GitHub workflows run manually and green
- [ ] `pg_cron` jobs fire at the intended farm-local time *(G-69)*
- [ ] A full day's logging for both flocks completes in under 2 minutes on a phone
- [ ] `CHANGELOG.md` current

---

## Open questions for the build

1. **Package manager** — plan assumes `pnpm`. Switch to npm or yarn if preferred; only the commands
   change.
2. **Where does the UI shell come from?** No mockups exist *(G-54)*. Component library, or build
   against `DESIGN.md` tokens directly?
3. **Who runs the manual pre-launch checks?** They need a real Supabase project and a real email
   address, so they cannot be delegated to CI.
