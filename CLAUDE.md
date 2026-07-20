# CLAUDE.md — PoultryPilot

## ⚠️ Mandatory rule: log every change

**Every change to this repository must be recorded in [CHANGELOG.md](CHANGELOG.md), in the same
session as the change. No exceptions.**

This covers:

- Editing, creating, deleting, renaming, or moving **any** file — specification documents, schema,
  code, configuration, assets.
- **Decisions**, even when nothing on disk changes. Choosing an approach, rejecting an alternative,
  or deferring a feature all get an entry typed `Decided`.
- **Deletions and removals**, logged with the same detail as additions.
- Changes to `CHANGELOG.md`'s own siblings — including this file.

### How to comply

1. Make the change.
2. Add an entry at the **top** of `CHANGELOG.md` under today's date, following the format specified
   in that file's header.
3. **`Why:` is required on every entry.** A diff already shows what changed; the log exists to
   capture why. State what was wrong and what breaks if it isn't addressed.
4. If the change touches an item in [GAPS.md](docs/GAPS.md), reference the gap ID and update that item's
   status in the same session.
5. **Never edit or delete a past entry.** Corrections are new entries that supersede old ones.

Do not batch entries for "later" and do not end a session with unlogged changes. If you are unsure
whether something qualifies, log it — an over-detailed log costs nothing, a missing entry costs the
reasoning permanently.

---

## What this repository is

A **specification-only** repository for PoultryPilot, a farm management system for small-scale
poultry operations (one farm, ~100 birds: 50 layers, 50 broilers). There is no application code
yet — these documents are the product.

**Specification documents live in [`docs/`](docs/).** Only `CLAUDE.md` and `CHANGELOG.md` sit at the
repository root — `CLAUDE.md` because Claude Code loads it from the root, `CHANGELOG.md` by
convention.

| Document | Role |
|:---|:---|
| `docs/PRD.md` | Vision, functional requirements FR-01…FR-13, NFRs, scope |
| `docs/REQUIREMENTS.md` | **Revision 2** — FR-01…FR-13 in SHALL/MUST form, Given/When/Then acceptance criteria |
| `docs/USER_FLOWS.md` | **Revision 2** — flows per role, with alternative and error paths |
| `docs/DATABASE.md` | **Revision 2** — ERD, table definitions, invariants, derived metrics, Prisma schema |
| `docs/API.md` | **Revision 2** — REST contract, `/api/v1`, error codes, Phase 1 surface |
| `docs/BUSINESS_RULES.md` | **Revision 2** — BR-01…BR-66, validation, state transitions, metric formulas |
| `docs/DESIGN.md` | **Revision 2** — verified-contrast palette, chart specs, states, breakpoints, dark mode |
| `docs/ROADMAP.md` | Phases, MVP priorities, milestones |
| `docs/TESTING.md` | Test strategy, the must-cover list, CI gates, manual pre-launch checks |
| `docs/GAPS.md` | 76 catalogued issues with resolution status — 51 closed, 25 open |
| `CHANGELOG.md` | Append-only record of every change |

**Planned stack:** Next.js (frontend **and** API via Route Handlers) · Prisma · **Supabase**
(Postgres, Auth, Storage, `pg_cron`) · SendGrid (alert email only) · **Vercel**. Free tier
permanently, by decision.

**Superseded — do not reintroduce:** NestJS as a separate backend, Clerk for authentication,
Render/Fly.io hosting. All three appear in early changelog entries; the platform moved on
2026-07-20.

## Working norms

- **These documents cross-reference each other heavily.** The schema, API contract, and business
  rules encode the same decisions in three places. Changing one without the others is how the v1 set
  accumulated 64 contradictions — check the siblings before considering a change complete, and note
  any deliberate lag in the changelog.
- **Authority order:** `DATABASE.md` defines structure and invariants · `BUSINESS_RULES.md` defines
  logic and policy · `API.md` defines transport · `USER_FLOWS.md` defines interaction. Where they
  disagree, the earlier one wins and the disagreement is a bug to log.
- **All eight specification documents are at revision 2 and mutually consistent.** 47 of 64
  catalogued gaps are closed. Before changing one, check what it implies for its siblings.
- **Serverless constrains the data layer.** Use Supabase's transaction-mode pooler; advisory locks
  and prepared statements are unavailable. Stock-moving writes take `SELECT … FOR UPDATE` row locks
  inside a Prisma interactive transaction *(I-15)*. Advisory locks appear to work locally against a
  direct connection and fail silently in production.
- **Two critical platform gaps are open.** Do not treat the system as secure or the invite flow as
  working until both are closed:
  - **G-65** — Supabase's Data API serves every table to the public anon key. RLS must be enabled
    and forced on all tables, with no policies. Re-run the lockdown after **every** migration that
    adds a table; Prisma does not manage RLS.
  - **G-66** — Supabase's default SMTP sends 2 emails/hour and refuses non-team addresses, so user
    invitations fail *silently*. Custom SMTP is required.
- **Other risks open by choice:** G-56 (online-only versus in-barn entry), G-70 (Vercel Hobby is
  non-commercial). Do not quietly resolve either.
- **Launch prerequisites are listed in [ROADMAP.md](docs/ROADMAP.md)** and are verified, not assumed.
- **Colour tokens are contrast-verified.** Any new colour must have its ratio computed against its
  intended background before use — the v1 palette failed because colours were chosen by eye.
- **Use stable IDs when referring to things:** `FR-01` (PRD), `BR-08` (business rules), `G-07`
  (gaps), `I-03` (schema invariants).
- **Don't silently resolve a contradiction between documents.** Surface it, and if a decision is
  needed, ask — then record the decision and the rejected alternatives in the changelog.
- **Money is `Decimal`, never `Float`.** All day boundaries resolve against `Farm.timezone`. These
  are settled decisions; see `DATABASE.md` conventions.
- **Flag what you could not verify.** The Prisma schema has never been run through
  `prisma validate` — there is no Node project here. Say so rather than implying it is checked.
