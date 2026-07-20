# REQUIREMENTS.md: PoultryPilot

> **Revision 2.** Rewritten against [DATABASE.md](DATABASE.md), [BUSINESS_RULES.md](BUSINESS_RULES.md),
> [API.md](API.md), and [USER_FLOWS.md](USER_FLOWS.md), all revision 2. The v1 acceptance criteria
> referenced fields that no longer exist (`averageWeightG` on the daily log, `initialBirdCount`) and
> tested behaviour the system does not implement.
>
> **FR-11, FR-12, and FR-13 are new** — processing, withdrawal enforcement, and audit. They cover
> capability specified across the other documents that no requirement backed.
> [PRD.md](PRD.md) has been updated to match.

**Conventions**

- **MUST** — mandatory for release. **SHOULD** — expected, may be deferred with a logged decision.
  **MAY** — optional.
- Acceptance criteria are written **Given / When / Then** so they map directly onto test cases.
- Field names match the schema exactly. Enum values are transmitted as their schema members.
- Requirements are marked **`P1`** where in scope for Phase 1 of [ROADMAP.md](ROADMAP.md).

---

## 1. Functional Requirements

### FR-01: Flock Creation & Management · `P1`

The system SHALL allow an Admin to create and manage distinct flocks.

- The system MUST support flocks of type `LAYER` and `BROILER`. Type is set at creation and MUST be
  immutable thereafter *(BR-02)*.
- The system MUST maintain `currentCount` automatically. It MUST NOT be directly writable *(BR-13)*.
- The system MUST support per-flock `cycleLengthDays`, `breed`, `defaultFeedItemId`, and
  `growthCurveId`.
- The system MUST enforce the status transitions in *(BR §3.1)* and MUST NOT permit deletion of a
  flock with dependent logs *(I-14)*.
- The system SHOULD support optional individual bird tagging, unique within a flock *(BR-17)*.

**Acceptance criteria**

1. *Given* an Admin, *when* they create a flock named "Layer Flock 1" of type `LAYER` with
   `initialCount: 50` starting today, *then* it is created with `currentCount = 50` and
   `status = ACTIVE`.
2. *Given* an existing flock "Layer Flock 1", *when* an Admin creates another with the same name,
   *then* the request fails with `409`.
3. *Given* an existing flock, *when* any user attempts to change its `type`, *then* the request fails
   and the type is unchanged.
4. *Given* a flock with at least one daily log, *when* deletion is attempted, *then* no delete route
   exists; archiving succeeds instead.
5. *Given* a flock with tagging enabled, *when* bird `B-001` is added twice to the same flock, *then*
   the first succeeds and the second fails with `409`.
6. *Given* two different flocks, *when* each is given a bird tagged `B-001`, *then* both succeed —
   tags are unique per flock, not globally.

---

### FR-02: Daily Data Entry · `P1`

The system SHALL provide streamlined daily data entry, one record per flock per calendar day.

- The system MUST enforce one daily log per flock per calendar day in `Farm.timezone` *(BR-18)*.
- `LAYER` logs MUST capture `eggsCollected`, `crackedEggs`, `eggsDiscarded`, `feedConsumedKg`,
  `waterConsumedL`, and `mortalityCount`.
- `BROILER` logs MUST capture `feedConsumedKg`, `waterConsumedL`, and `mortalityCount`. Average
  weight MUST NOT be a daily-log field; it is a separate `WeightRecord` *(BR-20)*.
- The system MUST decrement `Flock.currentCount` by `mortalityCount` in the same transaction *(I-01)*.
- The system MUST reject a log whose `mortalityCount` exceeds `currentCount` *(BR-14)*.
- The system MUST permit backfilling to any date on or after `Flock.startDate`, and MUST NOT evaluate
  alerts for backfilled entries *(BR-21, BR-63)*.
- Editing a log MUST reverse and re-post its inventory movements rather than mutating ledger rows
  *(BR-22)*.

**Acceptance criteria**

1. *Given* an active layer flock of 50 birds, *when* a worker submits `eggsCollected: 45`,
   `crackedEggs: 3`, `eggsDiscarded: 0`, `feedConsumedKg: "5.200"`, `waterConsumedL: "10.500"`,
   `mortalityCount: 1`, *then* the log is created and `currentCount` becomes 49.
2. *Given* a log exists for that flock and date, *when* a second is submitted, *then* it fails with
   `409 DUPLICATE_DAILY_LOG` and the existing log is unchanged.
3. *Given* a flock with `currentCount: 2`, *when* a log with `mortalityCount: 3` is submitted, *then*
   it fails with `422 MORTALITY_EXCEEDS_FLOCK` and the count remains 2.
4. *Given* a layer flock of 48 birds, *when* `eggsCollected: 50` is submitted, *then* it fails
   validation — a hen lays at most one egg per day.
5. *Given* `eggsCollected: 10`, *when* `crackedEggs: 8` and `eggsDiscarded: 5` are submitted, *then*
   it fails validation.
6. *Given* a broiler flock, *when* a log including `eggsCollected` is submitted, *then* it fails
   with `400`.
7. *Given* a flock started 2026-07-01, *when* a log dated 2026-06-30 is submitted, *then* it fails
   with `400`.
8. *Given* a flock with `status: INACTIVE`, *when* a log is submitted, *then* it fails with
   `422 FLOCK_INACTIVE`.
9. *Given* a log dated three days ago whose mortality exceeds the alert threshold, *then* the log is
   created and **no alert is dispatched**.

---

### FR-03: Weight Sampling · `P1`

The system SHALL record periodic average-weight samples for broiler flocks.

- The system MUST record `recordDate`, `avgWeightG`, and `sampleSize`, one per flock per date.
- The system MUST reject weight records for `LAYER` flocks.

**Acceptance criteria**

1. *Given* a broiler flock, *when* a worker records `avgWeightG: "1820.00"` with `sampleSize: 10`,
   *then* it is stored and appears on the growth report.
2. *Given* a record exists for a date, *when* another is submitted for the same flock and date,
   *then* it fails with `409`.
3. *Given* a layer flock, *when* a weight record is submitted, *then* it fails.
4. *Given* `sampleSize: 0`, *then* it fails validation.

---

### FR-04: Health & Treatment Logging

The system SHALL enable logging of health events and the treatments administered for them.

- Health events MUST carry `severity` and a `status` of `OPEN` or `RESOLVED` *(BR-26)*.
- Treatments MUST be a sub-resource of a health event, supporting more than one per event.
- A treatment MUST reference an `InventoryItem` of type `MEDICATION` or `SUPPLEMENT`; free-text
  medication names MUST NOT be accepted *(BR-28)*.
- A treatment MUST record `quantityUsed` and deduct it from stock *(I-03)*.
- The system MUST compute and store `withdrawalUntil` and propagate the maximum to the flock
  *(BR-29, BR-30)*.

**Acceptance criteria**

1. *Given* a flock, *when* a worker logs "Coccidiosis observed" with `severity: MODERATE`, *then* it
   is created `OPEN` and appears among active dashboard alerts.
2. *Given* a `MILD` event, *then* it does **not** appear as a dashboard alert.
3. *Given* a health event, *when* two treatments are added, *then* both are stored against it.
4. *Given* "Antibiotic X" stock of `"1000.000"` ml, *when* a treatment records
   `quantityUsed: "150.000"`, *then* stock becomes `"850.000"`.
5. *Given* a treatment ending 2026-07-24 with `withdrawalPeriodDays: 7`, *then*
   `Treatment.withdrawalUntil` is 2026-07-31 and the flock's is at least that.
6. *Given* a flock already under withdrawal until 2026-08-10, *when* a treatment clearing 2026-07-31
   is added, *then* the flock's `withdrawalUntil` remains 2026-08-10.

---

### FR-05: Inventory Management · `P1` *(basics)*

The system SHALL track feed, medication, supplements, and sellable products.

**Phase 1** — item CRUD, reorder thresholds, manual stock adjustment, and low-stock warnings
*(G-12 decision)*.

**Phase 2** — automatic feed deduction on daily logs and medication deduction on treatments, an
append-only ledger, and weighted-average costing *(BR §6.1, §6.2)*.

- Stock MUST be held in the item's stock-keeping unit, with `unitsPerPackage` converting to sale
  units *(BR-39)*.
- Stock MAY go negative for `FEED_CONSUMPTION` and `TREATMENT`, returning a warning; it MUST NOT go
  negative for `SALE` *(BR-38)*.
- Items with transaction history MUST be deactivated, never deleted *(BR-40)*.
- `currentStock` MUST NOT be directly writable.

**Acceptance criteria**

1. *Given* an Admin creates "Layer Feed 16%" of type `FEED`, unit `kg`, initial stock `"500.000"` at
   `"0.6500"`/kg, *then* the item exists with that stock and one `IN`/`PURCHASE` transaction.
2. *Given* stock `"500.000"` at `avgUnitCost "0.6500"`, *when* `"250.000"` is added at `"0.6800"`,
   *then* stock is `"750.000"` and `avgUnitCost` is `"0.6600"`.
3. *Given* an `OUT` of `"5.000"` while `avgUnitCost` is `"0.6600"`, *then* the transaction stores
   `unitCostAtTime: "0.6600"` and `costAmount: "3.30"`.
4. *Given* that transaction exists, *when* the item's cost later changes, *then* `costAmount` is
   unchanged and historical reports do not shift.
5. *Given* feed stock of `"2.000"` kg, *when* a daily log reports `"5.000"` kg consumed, *then* the
   log **succeeds** with a warning and stock becomes `"-3.000"`.
6. *Given* egg stock of 10, *when* a sale of 1 dozen is fulfilled, *then* it fails with
   `409 INSUFFICIENT_STOCK`.
7. *Given* an item with transactions, *when* deletion is attempted, *then* no delete route exists;
   deactivation succeeds and it disappears from selection lists.

---

### FR-06: Dashboard · `P1`

The system SHALL present current farm status at a glance.

- Metrics MUST be reported **per flock**, not aggregated across flock types.
- The dashboard MUST show sellable eggs today against the trailing 7-day average, per-flock FCR,
  mortality rate, water:feed ratio, days to processing, low-stock items, active health alerts, and
  **active withdrawal banners**.
- All formulas MUST follow *(BR §9)*.
- Financial values MUST be **absent from the response** for `FARM_WORKER`, not merely hidden in the
  UI *(BR §2.1)*.
- Metrics that cannot be computed MUST render as "—" with an explanation, never as `0`.

**Acceptance criteria**

1. *Given* a layer flock with 42 sellable eggs today and a 7-day average of 41.6, *then* both are
   shown.
2. *Given* a broiler flock started 30 days ago with `cycleLengthDays: 45`, *then* `daysToProcessing`
   is 15.
3. *Given* a broiler flock with no weight record, *then* FCR renders as "—" with an explanation.
4. *Given* a `FARM_WORKER` token, *when* `GET /dashboard/metrics` is called, *then* the response
   contains no cost, revenue, margin, or unit-price field.
5. *Given* feed stock below its reorder threshold, *then* the item appears in `lowInventory`.
6. *Given* a flock with `withdrawalUntil` in the future, *then* a banner names the flock and the
   clearance date.
7. *Given* a farm with two flocks, *then* mortality is reported per flock — no single farm-wide
   mortality rate spanning a layer and a broiler flock is reported.

---

### FR-07: Reporting

The system SHALL generate operational and financial reports.

- **Egg Production** — production and hen-day % over a date range. Requires ≥7 days of data.
- **Broiler Growth** — actual against the flock's `GrowthCurve`. MUST return `404` when the flock has
  no curve, rather than plotting against nothing.
- **Cost & Revenue** — revenue, input cost, and **gross margin**. MUST be labelled `grossMargin`,
  never "net profit", and MUST state its cost basis *(BR-44)*.
- Reports MUST accept `startDate` and `endDate` and SHOULD export to CSV and PDF.

**Acceptance criteria**

1. *Given* 14 days of layer logs, *when* a 7-day report is generated, *then* it returns 7 points with
   hen-day % per day.
2. *Given* only 3 days of data, *when* a report is requested, *then* an explanatory empty state names
   the shortfall.
3. *Given* a broiler flock with no `growthCurveId`, *when* the growth report is requested, *then* it
   returns `404`.
4. *Given* a flock with a curve and two weight records, *then* the report returns actual and target
   weight per sampled day.
5. *Given* a `FARM_WORKER` token, *when* `GET /reports/cost-revenue` is called, *then* it returns
   `403`.
6. *Given* fulfilled orders totalling 1,500 and consumption costing 800, *then* the report returns
   `grossMargin` of 700 with a stated cost basis.
7. *Given* orders in `DRAFT` or `PLACED`, *then* they contribute nothing to revenue.

---

### FR-08: Alerts

The system SHALL notify configured recipients of critical conditions by email.

- Thresholds MUST resolve per-flock first, then farm-wide *(BR-58)*.
- Every alert MUST write an `AlertEvent` before dispatch *(BR-59)*.
- Repeat firing MUST be suppressed by `dedupeKey` and `cooldownHours` *(BR-60)*.
- Delivery failure MUST NOT roll back the event *(BR-62)*.
- Each setting MUST support multiple recipients.
- **Production drop** MUST require at least 4 logged days in the trailing 7, MUST exclude missing
  days from the average, and MUST compare sellable eggs *(BR §8.2)*.

**Acceptance criteria**

1. *Given* a 7-day sellable average of 45 and a 15% threshold, *when* a day records 30 sellable eggs,
   *then* an alert fires and an `AlertEvent` is written.
2. *Given* a flock with only 3 logged days, *when* production drops sharply, *then* **no alert
   fires**.
3. *Given* the trailing 7 days include 2 unlogged days, *then* the average is computed over the 5
   logged days and the missing days are not counted as zero.
4. *Given* a mortality threshold of 2, *when* 3 deaths are logged within 24 hours, *then* an alert
   fires.
5. *Given* a per-flock threshold of 3 and a farm-wide threshold of 2, *when* that flock logs 3
   deaths, *then* no alert fires — the override applies.
6. *Given* a low-inventory alert fired 2 hours ago with a 24-hour cooldown, *when* another movement
   leaves the item below threshold, *then* an `AlertEvent` is written `SUPPRESSED` and **no email is
   sent**.
7. *Given* SendGrid returns an error, *then* the `AlertEvent` is retained `FAILED` with a reason and
   the alert still appears in-app.

---

### FR-09: Sales & Invoicing

The system SHALL support sales orders, customers, and invoices.

- Orders MUST follow `DRAFT → PLACED → FULFILLED`, with cancellation from `DRAFT` or `PLACED`
  *(BR §7.1)*.
- Stock MUST deduct **exactly once**, on fulfilment *(I-10)*.
- Line items MUST reference `inventoryItemId`; free-text product names MUST NOT be accepted *(BR-51)*.
- Line items MUST carry `sourceFlockId` where the product originates from a flock *(BR-52)*.
- An invoice MUST be issuable only for a `FULFILLED` order, at most once, with an immutable number
  and frozen totals *(BR-55…57)*.

**Acceptance criteria**

1. *Given* an Admin creates an order for 3 dozen eggs and 1 processed chicken, *then* it is `DRAFT`
   with **no stock movement**.
2. *Given* a `DRAFT` order, *when* fulfilment is attempted, *then* it fails with
   `422 INVALID_STATE_TRANSITION`.
3. *Given* a `PLACED` order for 3 dozen eggs and egg stock of 42, *when* fulfilled, *then* stock
   becomes 6 — 3 packages × 12 units.
4. *Given* a fulfilled order, *when* fulfilment is repeated, *then* stock is unchanged.
5. *Given* a fulfilled order, *when* an invoice is issued twice, *then* the second fails with
   `409 INVOICE_ALREADY_ISSUED`.
6. *Given* an issued invoice, *when* the order is later edited, *then* the invoice total is
   unchanged.
7. *Given* a customer with order history, *when* deletion is attempted, *then* only deactivation is
   available.

---

### FR-10: User & System Administration · `P1`

The system SHALL allow an Admin to manage users and configuration.

- Invitations MUST be issued through **Supabase Auth**, carrying role and `farmId` in
  `raw_user_meta_data` *(BR-09)*.
- Local `User` rows MUST be created only by the trigger on `auth.users` *(BR-10)*.
- User `status` MUST be checked on **every request**, not only at sign-in *(BR-11)*.
- Users MUST be deactivated, never deleted *(BR-11)*.
- The sole remaining Admin MUST NOT be deactivable or demotable *(BR-12)*.
- Admins MUST be able to configure alert settings, thresholds, recipients, and reorder levels.

**Acceptance criteria**

0. *Given* custom SMTP is **not** configured, *when* an Admin invites any address outside the
   Supabase project team, *then* **no email is delivered** — Supabase's default mail service refuses
   it. This test must be run explicitly; the failure is silent and the UI reports success *(G-66)*.
1. *Given* custom SMTP **is** configured and an Admin invites `worker@farm.com` as `FARM_WORKER`,
   *then* the invitation is delivered and **no local `User` row is created yet**.
2. *Given* an accepted invitation, *when* the row lands in `auth.users`, *then* the trigger creates a
   local `User` as `FARM_WORKER` / `ACTIVE` **in the same transaction** — there is no interval in
   which the user can authenticate without a local row.
3. *Given* the trigger runs twice for the same `authUserId`, *then* only one `User` row exists.
4. *Given* an invitation with no `role` in metadata, *then* the trigger defaults the user to
   `FARM_WORKER`, never `ADMIN`.
5. *Given* a worker who has authored logs is deactivated, *then* their logs remain, `createdById`
   still resolves, and their `auth.users` row is untouched.
6. *Given* a farm with one Admin, *when* deactivating that Admin is attempted, *then* it fails.
7. *Given* a user deactivated **during an active session** with a still-valid access token, *when*
   they call any endpoint, *then* it returns `403` — status is re-checked per request.

---

### FR-11: Broiler Processing *(new)*

The system SHALL record the end of a broiler cycle and convert live birds into sellable stock.

- The system MUST record `processedAt`, `birdsProcessed`, `totalLiveWeightKg`,
  `totalDressedWeightKg`, and the produced item and units.
- Processing MUST set `currentCount` to 0 and `status` to `PROCESSED`, and MUST post an
  `IN`/`PRODUCTION` transaction.
- Processing MUST be limited to `BROILER` flocks, at most once, from `ACTIVE` *(BR-16)*.
- Product from a flock under withdrawal MUST inherit that withdrawal date.

**Acceptance criteria**

1. *Given* an active broiler flock of 48 birds, *when* processing records 48 birds and 48 units of
   "Whole Processed Chicken", *then* `currentCount` is 0, status is `PROCESSED`, and product stock
   increases by 48.
2. *Given* a processed flock, *when* processing is attempted again, *then* it fails.
3. *Given* a layer flock, *when* processing is attempted, *then* it fails.
4. *Given* processing records fewer birds than `currentCount`, *then* a warning reports the
   discrepancy and the operation proceeds on confirmation.
5. *Given* a processed flock, *then* broiler FCR is computed from cumulative feed and total live
   weight and reported as final.

> No v1 counterpart: the 45-day countdown reached zero and no document described what happened next
> *(G-09)*.

---

### FR-12: Medication Withdrawal Enforcement *(new)*

The system SHALL prevent the sale of product from flocks under medication withdrawal.

- A flock MUST be under withdrawal while `Flock.withdrawalUntil` is in the future *(BR-31)*.
- Fulfilment of an order containing a line item sourced from such a flock MUST be **rejected** with
  `422 WITHDRAWAL_ACTIVE` *(BR-32)*.
- Layer daily logs MUST prompt for `eggsDiscarded` during withdrawal, and sellable-egg posting MUST
  be suppressed *(BR-33)*.
- The dashboard MUST display an active withdrawal banner *(BR-34)*.
- Withdrawal MUST NOT be manually cleared *(BR-35)*.

**Acceptance criteria**

1. *Given* a treatment ending 2026-07-24 with a 7-day withdrawal, *then* the flock is under
   withdrawal until 2026-07-31.
2. *Given* a `PLACED` order sourced from that flock, *when* fulfilment is attempted 2026-07-28,
   *then* it fails with `422 WITHDRAWAL_ACTIVE` naming the clearance date, and the order stays
   `PLACED`.
3. *Given* the same order, *when* fulfilment is attempted 2026-08-01, *then* it succeeds.
4. *Given* a layer flock under withdrawal, *when* a log records 45 collected and 45 discarded, *then*
   **no** eggs are added to sellable stock.
5. *Given* a flock under withdrawal, *when* any user attempts to clear the flag, *then* no such
   action exists in the UI or the API.
6. *Given* a flock under withdrawal, *then* the dashboard shows a banner with the flock name and
   clearance date.

> The one requirement here whose failure mode is a person's health rather than a wrong number. v1
> stored the withdrawal period and ignored it entirely *(G-10)*.

---

### FR-13: Audit Trail *(new)*

The system SHALL record an immutable audit trail of all business-data changes.

- Every create, update, and delete MUST write an `AuditLog` row with actor, action, entity, and a
  before/after diff *(BR-64)*.
- Audit rows MUST be immutable and MUST NOT be deleted, including when their actor is deactivated
  *(BR-65)*.
- The audit log MUST be readable by Admins only.

**Acceptance criteria**

1. *Given* a worker edits a daily log's `feedConsumedKg` from `"5.200"` to `"5.500"`, *then* an audit
   row records the actor, timestamp, and both values.
2. *Given* that worker is later deactivated, *then* the audit row still resolves to their identity.
3. *Given* a `FARM_WORKER` token, *when* `GET /audit-logs` is called, *then* it returns `403`.
4. *Given* any audit row, *then* no API route permits editing or deleting it.

---

## 2. Non-Functional Requirements

| Category | Requirement | Target |
|:---|:---|:---|
| **Performance** | API response time (p95) | < 200 ms |
| | Page load (LCP) | < 2.5 s |
| **Scalability** | Design capacity | 1 farm, 5 flocks, 1,000 birds |
| | Concurrent users | 5 |
| **Availability** | Uptime | 99.5% (goal; no SLA, no redundancy) |
| **Recoverability** | Automated backups | ⚠️ **None** on the free tier — see below |
| **Security** | Authorization | RBAC on every route; no unauthenticated access. User `status` re-checked per request |
| | **Data API** | 🔴 RLS enabled and forced on **every** `public` table, with no policies. Without this the anon key bypasses all RBAC *(G-65)* |
| | Secrets | Service-role key, JWT secret, and database URLs are server-side only and must never carry a `NEXT_PUBLIC_` prefix *(G-72)* |
| | Environments | Production database credentials scoped to the Production environment only; previews must not reach production data *(G-67)* |
| | Transport | HTTPS, TLS 1.2+ |
| | Financial data | Stripped from responses by role, not hidden client-side |
| **Data integrity** | Money | `Decimal`, never `Float`; serialised as JSON strings |
| | Stock | Append-only ledger; `currentStock` reconciled nightly *(I-05)* |
| | Concurrency | Stock-moving writes in one transaction with row locks |
| **Usability** | Interface | Responsive web, desktop and mobile browsers |
| | Onboarding | First-run guided setup completable in under 5 minutes |
| **Accessibility** | Standard | WCAG 2.1 AA — see [DESIGN.md](DESIGN.md) |

> ### G-57 resolved — targets stand, with two qualifications
>
> The original conflict was between these targets and container tiers that spin down for ~1 minute.
> Moving to Vercel serverless removes it: cold starts are ~100–300ms, and the workload is trivial
> (five flocks, ~1,800 log rows a year), so **warm p95 < 200 ms is comfortably achievable**.
>
> Two qualifications remain, recorded rather than resolved:
>
> 1. **The first request after a cold start may exceed 200 ms.** With one user logging once daily,
>    that is most first-requests-of-the-day. The target is understood as warm-path.
> 2. **99.5% uptime is a goal, not a guarantee.** There is no redundancy, no failover, and no SLA on
>    a free tier — and Supabase pauses the project after 7 days idle. The consequence of a breach is
>    low (the farmer logs an hour later), which is why this is acceptable rather than alarming.

---

## 3. Technical Constraints

- **Platform** — web only; no native mobile application in this phase.
- **Stack** — Next.js for both frontend and API (Route Handlers), PostgreSQL via Prisma, Supabase
  Auth, `pg_cron` for scheduled jobs, SendGrid for alert email only (**not** invitations).
- **Infrastructure** — Vercel (frontend + API) and Supabase (database, auth, storage, cron). No
  separate backend host.
- **Database access** — serverless requires Supabase's transaction-mode pooler. Advisory locks and
  prepared statements are unavailable; row locks inside a transaction are not *(I-15)*.
- **Free tier, by decision** — 500 MB database, project pauses after 7 days idle, **no automated
  backups**. See the operational note below.
- **Single farm** — no multi-tenancy. Serving a second customer requires a second deployment.
- **Budget** — $0/month by decision.

> ### ⚠️ Free-tier operational risk
>
> Running permanently on Supabase's free tier is an explicit decision, and it leaves two NFRs
> unmet:
>
> 1. **No automated backups.** A year of production records and financial history has no recovery
>    path from accidental deletion or corruption. Tracked as **G-59**.
> 2. **Project pauses after 7 days without an API request.** Daily farm use prevents this, but a
>    quiet week — between broiler cycles, or during a holiday — suspends the project until someone
>    manually resumes it.
>
> Both are addressable at $0 with scheduled jobs (a keep-alive ping and a `pg_dump` to versioned
> storage) and neither is addressed by default. **Until those exist, this system should not be
> treated as a farm's sole record of truth.**

---

## 4. Assumptions

- **Connectivity** — users have reliable internet where data is entered. ⚠️ The riskiest assumption
  in the set: the product targets in-barn mobile entry while offline mode is explicitly out of scope.
  Unresolved, tracked as **G-56**.
- **Data accuracy** — users are responsible for what they enter. The system validates ranges and
  relationships, not truth.
- **Proficiency** — users have basic computer literacy.
- **Broiler cycle** — 45 days by default, configurable per flock. *(v1 assumed a fixed 45.)*
- **Scale** — initial targets assume ~100 birds across two flocks.
- **Costing** — weighted average, with no cost-of-production allocation to eggs or meat. The Cost &
  Revenue report therefore measures input cost against sales, not true margin *(BR-44)*.

---

## Open Items

| Gap | Issue |
|:---|:---|
| ~~G-24~~ | ~~No scheduler~~ — **closed**: `pg_cron` ships with Supabase. |
| ~~G-57~~ | ~~Targets versus hosting~~ — **closed**: serverless removes the cold-start conflict. |
| **G-59** | **No automated backups.** Free-tier decision. Needs a scheduled `pg_dump`. |
| **G-27** | No tax-rate configuration; tax is a manual per-order amount. |
| **G-42** | No vaccination scheduling — health logging is entirely reactive. |
| **G-43** | No expense entity; `grossMargin` covers input costs only. |
| **G-44** | Customer PII has no retention or deletion policy. |
| **G-45** | Individual bird tracking is inert — mortality is flock-level. |
| **G-56** | Online-only versus in-barn data entry. |
| — | **Free-tier pause after 7 days idle.** Needs a scheduled keep-alive ping. |
