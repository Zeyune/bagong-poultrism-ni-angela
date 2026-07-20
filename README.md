# PoultryPilot

Farm management for small-scale poultry operations — flock tracking, daily production and mortality
logging, inventory, and health records for a single farm running layers and broilers.

**Status: early implementation.** The specification is complete and internally consistent; the
application is at Phase 1, Step 2 of 9. See [`docs/PHASE1_PLAN.md`](docs/PHASE1_PLAN.md) for what is
built and what is not.

---

## Stack

| | |
|:---|:---|
| Frontend + API | Next.js 16 (App Router, Route Handlers) |
| Database | PostgreSQL via Supabase, Prisma 7 with `@prisma/adapter-pg` |
| Auth | Supabase Auth — provisioning via a Postgres trigger, not a webhook |
| Scheduled jobs | `pg_cron` |
| Email | SendGrid, for farm alerts only |
| Hosting | Vercel + Supabase, free tier |
| Tests | Vitest, local Supabase for integration |

---

## Getting started

Requires Node 24+ and Docker (for local Supabase).

```bash
npm install
cp .env.example .env.local     # local Supabase values are printed by `supabase start`
npx supabase start             # first run pulls ~8 GB of images
npx prisma migrate deploy
npm run db:sql                 # RLS lockdown, auth triggers, seed data
npm run dev
```

Verify the database layer:

```bash
npm run verify:step1           # 11 checks: seed, auth trigger, deactivation, row locks
npm run test:gates             # the four CI gates
```

### Useful commands

| Command | Purpose |
|:---|:---|
| `npm run db:sql` | Apply `supabase/sql/*` in order — **re-run after every migration** |
| `npm run db:reset` | Reset the database and reapply everything |
| `npm run test:gates` | RLS, secrets, coverage map, advisory locks |
| `npm run test:rls` | Assert no `public` table is missing row level security |

---

## Documentation

The specification is the product; the code implements it. All eight specification documents are at
revision 2 and mutually consistent.

| Document | Contents |
|:---|:---|
| [`docs/PRD.md`](docs/PRD.md) | Vision, FR-01…FR-13, scope |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Requirements in SHALL/MUST form, 66 Given/When/Then criteria |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema, 15 invariants, derived metrics, Supabase integration |
| [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) | BR-01…BR-66, validation, state transitions, formulas |
| [`docs/API.md`](docs/API.md) | REST contract at `/api/v1` |
| [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) | Flows per role, with error and alternative paths |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Contrast-verified palette, chart specs, states, dark mode |
| [`docs/TESTING.md`](docs/TESTING.md) | Test strategy, must-cover list, CI gates |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phases, priorities, launch prerequisites |
| [`docs/GAPS.md`](docs/GAPS.md) | 80 catalogued issues — 60 closed, 20 open |
| [`CHANGELOG.md`](CHANGELOG.md) | Append-only record of every change and decision |

---

## Before this runs against real farm data

Two open items **fail silently** — the system looks correct while being wrong. Both are launch
prerequisites in [`docs/ROADMAP.md`](docs/ROADMAP.md):

- **G-66 — user invitations do not work.** Supabase's default mail service sends 2 messages/hour and
  refuses any address outside the project team. The admin sends an invite, the UI reports success,
  and the worker receives nothing. Requires custom SMTP.
- **G-68 — backups have never been restore-tested.** A backup that has never been restored is a
  claim, not a capability.

Row level security *(G-65)* is enabled, forced, and verified end-to-end — the public anon key
returns `401` on every table, and CI fails if that stops being true.

---

## Contributing

Every change is recorded in [`CHANGELOG.md`](CHANGELOG.md) in the same session it is made, with a
mandatory `Why:`. A diff shows what changed; only the log shows why. See [`CLAUDE.md`](CLAUDE.md).
