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
4. If the change touches an item in [GAPS.md](GAPS.md), reference the gap ID and update that item's
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

| Document | Role |
|:---|:---|
| `PRD.md` | Vision, functional requirements FR-01…FR-10, NFRs, scope |
| `REQUIREMENTS.md` | The same requirements in SHALL/MUST form, with acceptance criteria |
| `USER_FLOWS.md` | Step-by-step flows per role |
| `DATABASE.md` | **Schema revision 2** — ERD, table definitions, invariants, derived metrics, Prisma schema |
| `API.md` | REST contract *(stale — predates schema rev 2)* |
| `BUSINESS_RULES.md` | Business logic, validation, state transitions *(stale — predates schema rev 2)* |
| `DESIGN.md` | Visual identity, design tokens, accessibility |
| `ROADMAP.md` | Phases, MVP priorities, milestones |
| `GAPS.md` | 64 catalogued issues, ranked P0–P3, with resolution status |
| `CHANGELOG.md` | Append-only record of every change |

**Planned stack:** Next.js · NestJS · PostgreSQL (Prisma) · Clerk (auth) · SendGrid (email) ·
Vercel + Render/Fly.io.

## Working norms

- **These documents cross-reference each other heavily.** The schema, API contract, and business
  rules encode the same decisions in three places. Changing one without the others is how the v1 set
  accumulated 64 contradictions — check the siblings before considering a change complete, and note
  any deliberate lag in the changelog.
- **`API.md` and `BUSINESS_RULES.md` are known-stale** against schema revision 2. Their status
  vocabularies, field names, and endpoint shapes contradict `DATABASE.md`. Treat `DATABASE.md` as
  authoritative until they are rewritten (GAPS.md items 2 and 3 in the recommended work order).
- **Use stable IDs when referring to things:** `FR-01` (PRD), `BR-08` (business rules), `G-07`
  (gaps), `I-03` (schema invariants).
- **Don't silently resolve a contradiction between documents.** Surface it, and if a decision is
  needed, ask — then record the decision and the rejected alternatives in the changelog.
- **Money is `Decimal`, never `Float`.** All day boundaries resolve against `Farm.timezone`. These
  are settled decisions; see `DATABASE.md` conventions.
- **Flag what you could not verify.** The Prisma schema has never been run through
  `prisma validate` — there is no Node project here. Say so rather than implying it is checked.
