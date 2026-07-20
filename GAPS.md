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

**Counts:** 12 P0 · 21 P1 · 19 P2 · 12 P3 — 64 total. 23 resolved in the schema revision; 41 open.

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
**Fix:** Password removed, `clerkUserId String @unique` added. **Still open:** the Clerk webhook
endpoint (`POST /api/webhooks/clerk`) must be added to API.md — see G-30.

### G-04 · Invitation email sender contradicts itself ⬜
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

### G-10 · Withdrawal periods recorded but never enforced 🟡
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

### G-12 · Roadmap P0 depends on P1 ⬜
**Docs:** ROADMAP.md:28-30 vs :36-38
P0 includes "Low Inventory warnings" and "Admin can define inventory items and reorder thresholds",
but Inventory Management itself is P1. The MVP cannot ship as scoped.
**Fix:** Move inventory CRUD + stock tracking into P0; keep automatic deduction in P1 if needed.
This also means re-baselining the Phase 1 estimate.

---

## P1 — Correctness

### G-13 · Status vocabularies disagree across three documents ✅
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

### G-17 · Edit and delete semantics for logs undefined 🟡
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

### G-20 · FCR is a headline metric with no definition ✅
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

### G-22 · Production-drop alert undefined at the edges ✅
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

### G-24 · No scheduler exists in the architecture ⬜
**Docs:** PRD.md FR-07, ROADMAP.md, REQUIREMENTS.md §3
Low-inventory alerts need a periodic job. There is no cron, worker, or queue in the technology
stack, the hosting plan, or the roadmap. Only log-submission-triggered alerts are possible as
specified.
**Fix:** Add a scheduled worker (Render cron job or a NestJS `@Cron` task) to the stack table and to
Phase 3. Decide the evaluation cadence.

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

### G-30 · No Clerk webhook endpoint ⬜
**Docs:** API.md, ROADMAP.md:73
ROADMAP lists "webhook setup" as an external dependency. API.md documents no webhook route. Without
it, users created or deleted in Clerk never appear in or leave the local `User` table.
**Fix:** Document `POST /api/webhooks/clerk` handling `user.created`, `user.updated`,
`user.deleted`, including signature verification.

### G-31 · Duplicate and conflicting config endpoints ⬜
**Docs:** API.md:146-148
`/api/config/inventory-thresholds` (GET and PUT) duplicates `PUT /api/inventory/:id`, and the PUT
takes `itemId` in the body rather than the path.
**Fix:** Delete both `/api/config/inventory-thresholds` routes.

### G-32 · Health log API contradicts the data model ⬜
**Docs:** API.md:104 vs DATABASE.md
`POST /api/health-logs` embeds a single treatment inline (`treatment`, `dosage`,
`withdrawalPeriodDays`), while the schema models `HealthLog 1—N Treatment`. The API cannot express a
second treatment, and there are no treatment endpoints at all.
**Fix:** Add `POST/GET/PUT/DELETE /api/health-logs/:id/treatments`; remove the inline fields.

### G-33 · Bird status and notes fields the API sent but the schema lacked ✅
**Docs:** API.md:89 vs DATABASE.md
`PUT /api/birds/:id` sends `{"status": "Healthy", "notes": "..."}`. `BirdStatus` has no `Healthy`
member and there was no `notes` column.
**Fix:** `Bird.notes` added. **Still open:** API.md must use real enum members.

---

## P2 — Completeness

| ID | Gap | Docs | Status |
|:---|:---|:---|:---|
| **G-34** | **No `401`/`403` in any status code list.** The security NFR is "RBAC enforced on all API routes" and the contract never documents an auth failure. No `409` either, though `@@unique([flockId, logDate])` makes duplicate-log conflicts routine, and no `422` or `500`. | API.md | ⬜ |
| **G-35** | **No query parameters documented anywhere.** Reports take "a specified period" with no `startDate`/`endDate`. Report endpoints don't even accept a `flockId`. Pagination is defined in the response envelope but `page`/`limit` request params are never specified. | API.md | ⬜ |
| **G-36** | **Missing endpoints:** no `DELETE` for daily logs, health logs, inventory, customers, or sales orders; no treatment routes; no processing-event route; no `/api/farm` routes despite USER_FLOWS §2.1 being "Farm Settings"; no `/api/reports/*` export route despite flows offering PDF/CSV download. | API.md, USER_FLOWS.md | ⬜ |
| **G-37** | **Field names differ between API and DB throughout:** `initialBirdCount`/`initialCount`, `currentQuantity`/`currentStock`, `tagId`/`tag`, `averageWeightG`/`avgWeightG`, `"Layer"`/`LAYER`, `"Farm Worker"`/`FARM_WORKER`. No serialization convention is stated, so every endpoint is a guess. | API.md, DATABASE.md | 🟡 |
| **G-38** | **`POST /api/inventory` omits required fields** — `type` (a required enum) and cost are absent from the request body example. | API.md:113 | ⬜ |
| **G-39** | **No API versioning.** `/api/` rather than `/api/v1/`. | API.md | ⬜ |
| **G-40** | **No invoice record.** PDFs generated on the fly with no invoice number, no issue date, no persisted artifact — a regenerated PDF may not match what the customer received. | DATABASE.md | ✅ |
| **G-41** | **Water consumption collected daily and used in nothing.** No metric, report, or alert. Water-intake drop is one of the earliest illness indicators in poultry — this is a missed feature as much as dead data. | all | ✅ |
| **G-42** | **No vaccination management.** The single most routine scheduled activity in poultry appears in zero documents; health logging is entirely reactive. | PRD.md, all | ⬜ |
| **G-43** | **Cost & Revenue is really "feed and meds vs. sales."** No chick purchase cost, labour, utilities, bedding, or equipment — there is no expense entity at all. Labelling the output "Net Profit" (`API.md:140`) will actively mislead the user. | PRD.md FR-06, API.md | ⬜ |
| **G-44** | **Customer PII with no retention, deletion, or export policy.** Names, emails, phone numbers, and addresses of third parties are stored with no GDPR posture. | PRD.md NFRs, REQUIREMENTS.md §2 | ⬜ |
| **G-45** | **Individual bird tracking is half-built.** Birds can be created, but mortality is flock-level so `Bird.status` never changes, there's no per-bird production data, no bird detail screen, and no delete. FR-01's acceptance criterion ("view its details") has nothing behind it. | PRD.md FR-01, USER_FLOWS.md | ⬜ |
| **G-46** | **No `onDelete` behaviour was declared on any relation.** "Archive or delete a flock" would orphan a year of logs. | DATABASE.md | ✅ |
| **G-47** | **No seed data specified.** Growth curves, `PRODUCT` inventory items, and default alert settings must exist or core features silently no-op. | DATABASE.md, ROADMAP.md | ✅ |
| **G-48** | **Missing user flows:** editing or deleting a daily log, backfilling a missed day, ending a broiler cycle, the onboarding guided tour (a stated NFR), responding to an alert, first-run empty state, the Farm Worker's restricted dashboard. Alternative/error flows are documented for exactly one of ~20 flows (login). | USER_FLOWS.md | ⬜ |
| **G-49** | **No `eggsCollected <= currentCount` validation.** A hen cannot lay more than one egg per day; the constraint list omits the most obvious data-integrity check in the domain. | BUSINESS_RULES.md §2 | ✅ |
| **G-50** | **`dosage` typed as String but validated as "a positive decimal value."** | DATABASE.md vs BUSINESS_RULES.md §2 | ✅ |
| **G-51** | **`Bird.tag` globally `@unique` while the prose says "unique within its flock."** | DATABASE.md:177 vs :406 | ✅ |
| **G-52** | **No weight sample size.** A 3-bird sample and a 50-bird sample are indistinguishable in the growth report. | DATABASE.md | ✅ |

---

## P3 — Quality, Process, Product

| ID | Gap | Docs | Status |
|:---|:---|:---|:---|
| **G-53** | **The colour palette fails the accessibility standard the same document sets.** DESIGN.md promises WCAG 2.1 AA (4.5:1), then specifies `--color-accent-yellow: #FFC107` (~1.6:1 on white), `--color-accent-orange: #FF9800` (~2.2:1), and `--color-primary-green: #4CAF50` (~3.0:1). None can legally carry text. It's the stock Material palette pasted in without contrast validation. | DESIGN.md | ⬜ |
| **G-54** | **DESIGN.md has no wireframes, chart specifications, chart colour palette, colourblind consideration, empty/loading/error states, mobile breakpoints, dark mode, icon set, or logo** — for a product whose stated identity is "data-rich". | DESIGN.md | ⬜ |
| **G-55** | **`3xl: 48px` dashboard metrics have no responsive scale** and will overflow on a phone — the stated primary field-entry device. | DESIGN.md | ⬜ |
| **G-56** | **The offline decision contradicts the adoption strategy.** "Offline data entry" is Out of Scope and "reliable internet" is an assumption — while the low-adoption mitigation is "ensure the mobile web experience is excellent for quick data entry *in the field*". A poultry house is exactly where connectivity fails. This is the riskiest assumption in the set and the documents resolve it in opposite directions. | PRD.md | ⬜ |
| **G-57** | **NFR targets are unachievable on the specified hosting.** p95 < 200ms, LCP < 2.5s, and 99.5% uptime on Render/Fly hobby tiers — cold starts alone exceed the API budget by an order of magnitude. The budget constraint says the targets must move, not the hosting. | PRD.md, REQUIREMENTS.md §3 | ⬜ |
| **G-58** | **No test strategy at all** — no test plan, coverage target, QA environment, or migration strategy. ROADMAP mitigates two separate risks with "automated testing" that is never specified or scheduled. | ROADMAP.md | ⬜ |
| **G-59** | **No backup, RPO, or RTO**, despite the data-integrity mitigation citing "regular data backups". No monitoring, error tracking, or rate limiting either. | PRD.md, ROADMAP.md | ⬜ |
| **G-60** | **Sales module priority contradicts itself.** P2 "Nice to Have" in the MVP list, but a Phase 3 goal and a week-14 "MVP Launch Candidate" deliverable. Separately, "P1 within 1 month post-launch" contradicts P1 being complete *before* the week-14 launch candidate. | ROADMAP.md | ⬜ |
| **G-61** | **Schedule is optimistic with no buffer.** 2 devs, 14 weeks, for auth + flocks + logs + inventory + health + 3 reports + alerts + sales + PDF + onboarding tour + WCAG AA. No QA resource. "UI/UX Mockups" is listed as an internal dependency with no owner and no date, yet Phase 1 starts immediately. | ROADMAP.md | ⬜ |
| **G-62** | **The economics are never addressed.** A 100-bird operation grosses a few thousand a year; there is no pricing model, business model, or willingness-to-pay discussion. The system is explicitly single-tenant, so it serves one customer per deployment, and per-customer ops cost is never mentioned. The PRD also targets 50–500 birds while the capacity NFR says 1,000. | PRD.md | ⬜ |
| **G-63** | **Success metrics measure usage, not value.** "DAU: 1+" is not a metric. NPS > 40 with n=1 is statistically meaningless. Nothing measures the actual product promise — did FCR improve, did mortality fall, was a problem caught earlier? All three are derivable from data the system already collects. | PRD.md | ⬜ |
| **G-64** | **PRD risk table is malformed** — the header declares three columns (Risk, Impact, Mitigation) and every row supplies four cells. It renders incorrectly. | PRD.md:120-125 | ⬜ |

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
