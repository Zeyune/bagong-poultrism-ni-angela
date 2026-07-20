# CHANGELOG: PoultryPilot

> **This file is mandatory and append-only.**
>
> Every change to anything in this repository — specification documents, schema, code, configuration,
> assets, this file's siblings — gets an entry here. No exceptions. If you added, modified, removed,
> renamed, or moved something, it is recorded below **in the same working session as the change**,
> not later.
>
> This applies to every contributor, human or AI. See [CLAUDE.md](CLAUDE.md) for the enforcement rule.

---

## How to write an entry

Newest entries go at the **top** of the log, under a date heading. Use this shape:

```markdown
## YYYY-MM-DD

### <Imperative summary of the change>
**Type:** Added | Changed | Removed | Fixed | Decided | Deprecated
**Files:** `path/one.md`, `path/two.ts`
**Related:** G-07, G-08 (GAPS.md) · FR-04 (PRD.md)

What changed, in one or two sentences.

**Why:** The reason. This is the part that matters — a diff shows what changed, only this
shows why. If the change reverses or supersedes an earlier decision, say so and link it.
```

**Rules**

1. **One entry per logical change**, not per file touched. A schema fix spanning four files is one
   entry listing four files.
2. **`Why:` is required.** An entry without a rationale is incomplete. "Because it was wrong" is not
   a rationale; say what was wrong and what breaks if it isn't fixed.
3. **Decisions count as changes.** Choosing Clerk over self-hosted auth modifies nothing on disk and
   still gets an entry, typed `Decided`.
4. **Deletions count.** Removing a field, a document, or a requirement is recorded with the same
   detail as adding one.
5. **Never rewrite history.** Corrections are new entries that supersede old ones. Do not edit or
   delete a past entry — if it was wrong, say so in a new one.
6. **Link the gap IDs.** If the change resolves or creates an item in [GAPS.md](GAPS.md), reference
   it, and update that item's status in the same session.

---

## 2026-07-20

### Place this repository under version control
**Type:** Added
**Files:** `.git/` (all eleven documents committed as `88470fb`)
**Related:** —

Ran `git init` and committed the full current state of the specification set as the initial commit.
The repository previously had no version control of any kind.

**Why:** Every historical fact about this repository lived in `CHANGELOG.md` alone, which meant the
log was doing two jobs at once — recording *what* changed, which a tool does better and
automatically, and recording *why*, which no tool can. With git carrying diffs, timestamps, and file
history, the log is free to concentrate on rationale. It also removes a real risk: an unversioned
specification set has no recovery path from an accidental overwrite, and `DATABASE.md` alone
represents the resolution of 33 catalogued gaps.

This does not relax the logging rule. Every change is still logged here with a mandatory `Why:`, on
the reasoning that a commit message records an intention at a moment while this file records the
decision and the alternatives that were rejected.

**Not verified:** no remote is configured, so nothing is backed up off this machine yet. The commit
was authored as `Effie <claudeeunika@gmail.com>`, which does **not** match the global git identity on
this machine (`Zeyune <tankenneth207@gmail.com>`) — see the note below.

---

### Extend the changelog rule to all future projects
**Type:** Decided
**Files:** `~/.claude/CLAUDE.md`
**Related:** —

Promoted this repository's mandatory-changelog rule to a device-wide standing instruction. Every
project worked on from now on gets a `CHANGELOG.md` with the same format, the same required `Why:`,
and the same append-only discipline. The file is created on the first substantive change in any
folder containing code, specifications, or a git repository.

**Why:** The rule proved its worth here and there is no reason it should be local to one repository.
Superseded alternatives: scaling strictness by project type, so code repositories with git would log
only decisions and milestones rather than every change (rejected — a rule with exceptions invites
argument about which case applies, and the reasoning behind a routine-looking edit is exactly what
gets lost); splitting into a separate `DECISIONS.md` (rejected — the `Decided` type already covers
it, and two files means two places to forget).

Creation is deliberately scoped to project-like folders rather than literally every directory, so
that home directories, scratch folders, and read-only checkouts of other people's repositories do
not accumulate stray changelogs.

---

### Persist the changelog rule outside the repository
**Type:** Added
**Files:** `~/.claude/projects/…/memory/poultrypilot-changelog-rule.md`, `…/memory/MEMORY.md`
**Related:** —

Wrote the changelog requirement to persistent memory so it survives outside this directory, in
addition to `CLAUDE.md` which covers sessions working inside it.

**Why:** `CLAUDE.md` only loads for work rooted in this directory. The memory entry covers the case
where the repository is discussed or modified from elsewhere. Recorded here despite the files
living outside the repo, because the rule is "all things related, no exceptions" — and a rule whose
own setup is unlogged undermines itself.

---

### Establish the mandatory change log
**Type:** Added
**Files:** `CHANGELOG.md`, `CLAUDE.md`
**Related:** —

Created this file as the single append-only record of all repository changes, and `CLAUDE.md` to
carry the rule into every future working session automatically.

**Why:** This is a specification repository where documents cross-reference each other heavily — the
schema, the API contract, the business rules, and the roadmap all encode the same decisions. A
change to one silently invalidates the others, which is precisely how the v1 document set
accumulated 64 contradictions. A log with mandatory rationale makes the coupling visible and gives
the next reader the reasoning, not just the diff.

---

### Rewrite DATABASE.md as schema revision 2
**Type:** Changed
**Files:** `DATABASE.md`
**Related:** G-01, G-02, G-03, G-05, G-06, G-07, G-08, G-09, G-11, G-13, G-14, G-15, G-16, G-18, G-19, G-20, G-21, G-22, G-23, G-25, G-26, G-27, G-28, G-29, G-33, G-40, G-41, G-46, G-47, G-49, G-50, G-51, G-52

Full rewrite of the data model. Fixed the duplicate `"FarmOwner"` relation name and the circular
required foreign key that made the schema uncompilable and unseedable. Removed the `password`
column in favour of `clerkUserId`. Moved all money columns from `Float` to `Decimal`. Added
`onDelete` behaviour to every relation.

Added columns that documented features depended on but that did not exist: `InventoryItem.avgUnitCost`,
`salePrice`, `unitsPerPackage`; `Treatment.quantityUsed`; `DailyLog.feedItemId`;
`Flock.defaultFeedItemId`; `DailyLog.eggsDiscarded`; `Treatment.withdrawalUntil`;
`Flock.withdrawalUntil`; `Farm.timezone`; `Farm.currency`; `Flock.breed`; `Flock.cycleLengthDays`;
`User.status`; `HealthLog.severity`/`status`/`resolvedAt`; `Bird.notes`; `Treatment.route`; and
`createdById` on all seven user-authored entities.

Added tables: `WeightRecord`, `ProcessingEvent`, `Invoice`, `AlertRecipient`, `AlertEvent`,
`GrowthCurve`, `GrowthCurvePoint`, `AuditLog`.

Reconciled `FlockStatus` and `SalesOrderStatus` to the vocabularies used in `BUSINESS_RULES.md`.
Extracted `avgWeightG` from `DailyLog` into `WeightRecord` with a `sampleSize`. Turned
`InventoryTransaction` into a real append-only ledger with `reason`, `unitCostAtTime`, `costAmount`,
and a self-referencing `reversalOf`.

Added three new sections: **Invariants** (I-01…I-14), **Derived Metrics** (FCR, hen-day %, mortality
rate, water:feed ratio), and a v1→v2 changelog.

**Why:** The v1 schema could not compile, could not be seeded, and could not support three of the
ten functional requirements. FR-04 (inventory deduction) had no field naming which feed item or how
much medication to deduct. FR-06's Cost & Revenue report referenced a unit cost column that did not
exist. FR-08 sold products from stock that was never created. The invariants and metric formulas
were added because v1 stated those rules in prose and wired them to nothing — FCR is the product's
headline metric and appeared in no document as a formula.

**Not verified by tooling:** there is no Node project in this directory, so `prisma validate` has
not been run against the schema. The relation naming and the `TxnReversal` self-relation are the
parts most worth validating first.

---

### Add GAPS.md
**Type:** Added
**Files:** `GAPS.md`
**Related:** all

Catalogued 64 issues across the eight specification documents, each with an ID, severity (P0–P3),
affected documents, a proposed fix, and a resolution status. 23 are resolved by schema revision 2;
41 remain open. Added a recommended order of work.

**Why:** The contradictions were distributed across documents in a way that made them invisible when
reading any single one — the sales module's stock deduction point, for example, was specified three
different ways in three files, each internally coherent. A single ranked list makes the coupling and
the blocking dependencies legible, and gives the open items stable IDs to reference from commits and
from this log.

---

### Decide: Clerk-only authentication
**Type:** Decided
**Files:** `DATABASE.md`
**Related:** G-03, G-04

Identity lives entirely in Clerk. The local `User` table stores a projection — role, status, farm
membership — keyed by `clerkUserId`, synchronised by a Clerk webhook. No local password storage.

**Why:** `PRD.md` and `REQUIREMENTS.md` both mandate Clerk, while the v1 schema carried a hashed
password column. Supporting both would mean two identity sources that can disagree, and doubles the
RBAC surface for a two-developer, fourteen-week build. Superseded alternatives: self-hosted
Passport/JWT auth (rejected — contradicts the stated stack and adds session, reset, invite, and MFA
work); Clerk with local fallback (rejected — worst of both).

**Follow-up owed:** `API.md` still documents no `POST /api/webhooks/clerk` route, and still says
invitations are sent via SendGrid where `USER_FLOWS.md` says Clerk. Tracked as G-04 and G-30.

---

### Decide: production auto-posts to PRODUCT inventory
**Type:** Decided
**Files:** `DATABASE.md`
**Related:** G-08, G-09

A daily log's sellable eggs (`eggsCollected - crackedEggs - eggsDiscarded`) automatically post as an
`IN`/`PRODUCTION` inventory transaction. A new `ProcessingEvent` converts a broiler flock's birds
into `PRODUCT` stock at the end of the cycle. `InventoryItem.unitsPerPackage` reconciles stock-keeping
units (eggs) with sale units (dozens).

**Why:** `SalesOrderItem` references `InventoryItem`, so selling eggs required egg stock to exist,
and nothing created it. Broilers were worse — no document contained any event converting live birds
into sellable product, so the 45-day countdown reached zero and nothing happened. Superseded
alternative: a separate `ProductBatch` table with per-batch traceability (defensible and more
correct for food traceability, deferred as too much UI for v1); manual sales with no inventory link
(rejected — removes the cost side of the Cost & Revenue report).

---

### Decide: withdrawal periods are enforced, not just recorded
**Type:** Decided
**Files:** `DATABASE.md`
**Related:** G-10

A `Treatment` computes and stores `withdrawalUntil`, which propagates to `Flock.withdrawalUntil`.
Fulfilling a sales order containing product from a flock under withdrawal is rejected with
`422 WITHDRAWAL_ACTIVE`. `DailyLog.eggsDiscarded` records eggs destroyed during the window.

**Why:** v1 stored `withdrawalPeriodDays` and then ignored it entirely — no block, no warning, no
flag, no discard tracking. Enforcement is the entire regulatory purpose of recording the field, and
the failure mode is contaminated product reaching a customer rather than a wrong number on a
dashboard. This is the one open item on the gap list I would not defer.

---

### Decide: weighted-average inventory costing
**Type:** Decided
**Files:** `DATABASE.md`
**Related:** G-07

`InventoryItem.avgUnitCost` is recomputed on every `IN` transaction. Every `OUT` transaction
snapshots the prevailing cost into `unitCostAtTime` and materialises `costAmount`.

**Why:** No costing method was specified at all, and no cost column existed. The snapshot matters
more than the method: without it, editing a feed price today silently rewrites last month's Cost &
Revenue report, which is exactly the data-integrity failure the PRD names as its top product risk.
Superseded alternatives: FIFO lots (more accurate, enables feed batch traceability, needs a lot
table and selection UI — reconsider if traceability becomes a requirement); a single static
`unitCost` (rejected for the rewriting-history problem above).

---

### Analyse the v1 specification set
**Type:** Changed
**Files:** — (analysis only)
**Related:** all

Read all eight specification documents and produced a gap analysis covering schema defects,
cross-document contradictions, domain omissions, API surface gaps, and product/business concerns.

**Why:** Requested as the entry point to the work above. Recorded here because the analysis is what
justified every subsequent change, and the reasoning is not otherwise captured on disk.
