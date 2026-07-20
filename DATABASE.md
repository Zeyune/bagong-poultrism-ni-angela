# DATABASE.md: PoultryPilot

> **Revision 2.** This supersedes the original schema. See [GAPS.md](GAPS.md) for the full list of
> issues that drove these changes, and the [Changelog](#changelog-v1--v2) at the end of this file
> for a summary of what moved.
>
> Four design decisions are baked into this revision:
> 1. **Auth is Clerk-only.** No local password column; `clerkUserId` is the identity link.
> 2. **Production auto-posts to inventory.** Eggs and processed broilers become real `PRODUCT` stock.
> 3. **Withdrawal periods are enforced,** not just recorded. Sales are blocked during withdrawal.
> 4. **Costing is weighted-average,** snapshotted per transaction so historical reports are stable.

## Conventions

| Concern | Convention | Rationale |
|:---|:---|:---|
| **Money** | `Decimal @db.Decimal(12, 2)` | Never `Float`. Binary floating point cannot represent currency exactly; `0.1 + 0.2 != 0.3` in an invoice total is a real defect. |
| **Unit costs** | `Decimal @db.Decimal(12, 4)` | Feed is priced per-kg at sub-cent precision; rounding at 2dp compounds across a 45-day cycle. |
| **Quantities** | `Decimal @db.Decimal(12, 3)` | Feed in kg, water in L, medication in ml. |
| **Counts** | `Int` | Birds, eggs, mortality. |
| **IDs** | `String @id @default(cuid())` | Opaque, sortable, safe in URLs. |
| **Dates** | `DateTime @db.Date` for calendar days, full `DateTime` for instants | `logDate` is a calendar day, not a moment. See [Timezones](#timezones). |
| **Enums in API** | Serialized as-is (`LAYER`, not `"Layer"`) | The original API.md used title-case strings that matched no enum. One vocabulary, everywhere. |
| **Soft delete** | `status`/`isActive` fields; no hard deletes on entities with history | Deleting a flock must not orphan a year of logs. |
| **Attribution** | `createdById` on every entity a user can author | Required for accountability, for the "own records" access rule, and for audit. |

### Timezones

`Farm.timezone` (IANA, e.g. `Africa/Nairobi`) is the authority for every calendar-day boundary in the
system. "Today's eggs", the `@@unique([flockId, logDate])` constraint, the 24-hour mortality window,
and the 7-day production average are **all** computed in farm-local time, then stored as UTC instants
or bare dates. Storing `logDate` as `@db.Date` means the application layer must resolve "today" in
farm time before writing — never `new Date()` on a server in another region.

### Currency

`Farm.currency` (ISO 4217, e.g. `KES`, `USD`) is set once at farm creation. All money columns are
denominated in it. There is no multi-currency support and no FX conversion; this is a deliberate v1
constraint, not an oversight.

---

## Entity Relationship Diagram

```mermaid
erDiagram
    Farm ||--o{ User : "employs"
    Farm |o--|| User : "owned_by"
    Farm ||--o{ Flock : manages
    Farm ||--o{ InventoryItem : tracks
    Farm ||--o{ Customer : serves
    Farm ||--o{ SalesOrder : processes
    Farm ||--o{ AlertSetting : configures
    Farm ||--o{ AlertEvent : records
    Farm ||--o{ GrowthCurve : defines
    Farm ||--o{ AuditLog : audits

    Flock ||--o{ Bird : contains
    Flock ||--o{ DailyLog : "logged daily"
    Flock ||--o{ WeightRecord : "weighed periodically"
    Flock ||--o{ HealthLog : "health tracked"
    Flock ||--o| ProcessingEvent : "processed into"
    Flock }o--o| InventoryItem : "default feed"
    Flock }o--o| GrowthCurve : "benchmarked against"

    Bird ||--o{ HealthLog : "individually affected"

    HealthLog ||--o{ Treatment : "treated by"
    Treatment }o--|| InventoryItem : consumes

    DailyLog }o--|| InventoryItem : "consumes feed"
    ProcessingEvent }o--|| InventoryItem : "produces"

    InventoryItem ||--o{ InventoryTransaction : "stock ledger"
    InventoryItem ||--o{ SalesOrderItem : "sold as"

    Customer ||--o{ SalesOrder : places
    SalesOrder ||--o{ SalesOrderItem : includes
    SalesOrder ||--o| Invoice : "invoiced by"
    SalesOrderItem }o--o| Flock : "sourced from"

    AlertSetting ||--o{ AlertRecipient : "notifies"
    AlertSetting ||--o{ AlertEvent : "fires"

    GrowthCurve ||--o{ GrowthCurvePoint : "plotted as"

    User ||--o{ DailyLog : creates
    User ||--o{ HealthLog : creates
    User ||--o{ InventoryTransaction : creates
    User ||--o{ SalesOrder : creates
```

---

## Bootstrap Order

The original schema had a circular required foreign key — `User.farmId` and `Farm.ownerId` each
required the other, making the first insert impossible. `Farm.ownerId` is now **nullable**, which
resolves the cycle. First-run sequence:

```
1. INSERT Farm        (ownerId = NULL, timezone, currency)
2. INSERT User        (farmId = <farm>, role = ADMIN, clerkUserId from Clerk webhook)
3. UPDATE Farm        SET ownerId = <user>
```

Steps 1–3 run inside a single transaction in the seed script and in the Clerk `user.created`
webhook handler for the very first user. `Farm.ownerId` is nullable in the schema but is treated as
required by application logic once bootstrap completes.

---

## Table Definitions

### User

Identity is owned by Clerk. This table stores the farm-local projection: role, status, and farm
membership. It is kept in sync by the `POST /api/webhooks/clerk` handler.

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `clerkUserId` | String | **Unique.** The link to Clerk. Set on `user.created` webhook. |
| `email` | String | Unique. Mirrored from Clerk for display and alert routing. |
| `name` | String | Mirrored from Clerk. |
| `role` | Enum | `ADMIN` \| `FARM_WORKER`. |
| `status` | Enum | `INVITED` \| `ACTIVE` \| `DEACTIVATED`. Was missing entirely in v1 despite the API exposing `isActive`. |
| `farmId` | String | FK → `Farm`. |
| `invitedAt` / `lastLoginAt` | DateTime? | Operational visibility for user management. |

> **No `password` column.** Authentication is entirely Clerk's responsibility. The v1 schema carried
> a hashed password field that contradicted the stated stack.

### Farm

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `name`, `location` | String | |
| `timezone` | String | IANA name. Authority for all day boundaries. **New.** |
| `currency` | String | ISO 4217. **New.** |
| `ownerId` | String? | **Nullable, unique.** FK → `User`. Nullable to break the bootstrap cycle. |

### Flock

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `farmId` | String | FK → `Farm`. |
| `type` | Enum | `LAYER` \| `BROILER`. |
| `name` | String | Unique per farm. |
| `breed` | String? | e.g. "Ross 308". Determines which growth curve is meaningful. **New.** |
| `initialCount` | Int | Birds at start. |
| `currentCount` | Int | **Maintained by the application**, not a stored guess. See [Invariants](#invariants). |
| `startDate` | DateTime | |
| `cycleLengthDays` | Int? | Defaults to 45 for broilers, null for layers. Was a hardcoded assumption in v1. **New.** |
| `status` | Enum | `ACTIVE` \| `INACTIVE` \| `PROCESSED` \| `ARCHIVED`. Now matches BUSINESS_RULES §3. |
| `defaultFeedItemId` | String? | FK → `InventoryItem`. **Resolves the "which feed do we deduct?" blocker.** |
| `growthCurveId` | String? | FK → `GrowthCurve`. |
| `withdrawalUntil` | DateTime? | Denormalized max withdrawal end across all treatments. Blocks sales. **New.** |

### Bird

Optional individual tracking. Only populated when the flock is created with tagging enabled.

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `flockId` | String | FK → `Flock`. |
| `tag` | String | **Unique per flock**, not globally. v1's `@unique` contradicted its own prose. |
| `status` | Enum | `ACTIVE` \| `CULLED` \| `SOLD` \| `DECEASED`. |
| `hatchDate` | DateTime? | |
| `notes` | String? | The API sent this field; the schema had nowhere to put it. **New.** |

### DailyLog

One row per flock per calendar day (farm-local). This is the highest-write table and the source of
truth for feed cost, production, and mortality.

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `flockId` | String | FK → `Flock`. |
| `logDate` | Date | `@@unique([flockId, logDate])`. |
| `feedItemId` | String? | FK → `InventoryItem`. **Which feed was consumed.** Defaults from `Flock.defaultFeedItemId`. Nullable so a log can still be saved when feed tracking isn't configured. |
| `feedConsumedKg` | Decimal | |
| `waterConsumedL` | Decimal | Now actually used — see [Derived Metrics](#derived-metrics). |
| `mortalityCount` | Int | |
| `eggsCollected` | Int? | Layer only. |
| `crackedEggs` | Int? | Layer only. Deducted from sellable output. |
| `eggsDiscarded` | Int? | Layer only. **Eggs destroyed under medication withdrawal.** Excluded from sellable output. **New.** |
| `notes` | String? | |
| `createdById` | String | FK → `User`. **New.** |

> `avgWeightG` has moved out of this table — see `WeightRecord`. Weight is sampled weekly, not
> daily, and carrying it here forced a nullable column that was empty ~86% of the time and gave no
> place to record sample size.

### WeightRecord

**New table.** Periodic (typically weekly) average weight sampling for broiler flocks.

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `flockId` | String | FK → `Flock`. |
| `recordDate` | Date | `@@unique([flockId, recordDate])`. |
| `avgWeightG` | Decimal | |
| `sampleSize` | Int | How many birds were weighed. Without it, a 3-bird sample and a 50-bird sample are indistinguishable in the growth report. |
| `createdById` | String | FK → `User`. |

### HealthLog

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `flockId` | String | FK → `Flock`. |
| `birdId` | String? | FK → `Bird`. Null if flock-wide. |
| `logDate` | DateTime | |
| `eventType` | String | |
| `severity` | Enum | `MILD` \| `MODERATE` \| `SEVERE`. Collected in USER_FLOWS, absent from the v1 schema. **New.** |
| `status` | Enum | `OPEN` \| `RESOLVED`. BUSINESS_RULES defined this transition against a field that didn't exist. **New.** |
| `resolvedAt` | DateTime? | **New.** |
| `description` | String? | |
| `createdById` | String | FK → `User`. **New.** |

### Treatment

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `healthLogId` | String | FK → `HealthLog`, cascade delete. |
| `inventoryItemId` | String | FK → `InventoryItem`. |
| `medicationName` | String | Denormalized for historical reporting. |
| `dosageText` | String | Free text as administered, e.g. "10ml/L drinking water". |
| `quantityUsed` | Decimal | **The actual amount deducted from stock.** v1 had no such field, making BR-09 unimplementable. |
| `unit` | String | Snapshot of the item's unit at time of use. |
| `route` | String? | Collected in USER_FLOWS, absent from v1 schema. **New.** |
| `startDate` / `endDate` | DateTime | |
| `withdrawalPeriodDays` | Int | |
| `withdrawalUntil` | DateTime | **Computed and stored** as `endDate + withdrawalPeriodDays`. Drives the sales block. **New.** |
| `createdById` | String | FK → `User`. **New.** |

### InventoryItem

Covers inputs (feed, medication, supplements) and outputs (`PRODUCT`: eggs, processed chicken).

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `farmId` | String | FK → `Farm`. |
| `name` | String | Unique per farm. |
| `type` | Enum | `FEED` \| `MEDICATION` \| `SUPPLEMENT` \| `PRODUCT`. |
| `unit` | String | The **stock-keeping** unit. Eggs are stocked as `egg`, not `dozen`. |
| `unitsPerPackage` | Int? | Sale packaging divisor. Eggs: `12`. **Resolves the eggs-vs-dozens mismatch.** **New.** |
| `currentStock` | Decimal | In `unit`. Maintained transactionally alongside the ledger. |
| `avgUnitCost` | Decimal | **Weighted-average cost.** Recomputed on every `IN` transaction. **New — this column simply did not exist in v1, making the entire Cost & Revenue report unimplementable.** |
| `salePrice` | Decimal? | Price per *package* for `PRODUCT` items. Populates sales order lines. **New.** |
| `reorderThreshold` | Decimal | |
| `isActive` | Boolean | Soft delete. |

### InventoryTransaction

The append-only stock ledger. `InventoryItem.currentStock` is a cached projection of it.

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `inventoryItemId` | String | FK → `InventoryItem`. |
| `transactionType` | Enum | `IN` \| `OUT`. |
| `reason` | Enum | `PURCHASE`, `PRODUCTION`, `MANUAL_ADJUSTMENT`, `FEED_CONSUMPTION`, `TREATMENT`, `SALE`, `SPOILAGE`, `REVERSAL`. **New** — v1 could not distinguish a purchase from a correction. |
| `quantity` | Decimal | Always positive; direction comes from `transactionType`. |
| `unitCostAtTime` | Decimal? | **Snapshot.** Historical cost reports must not change when someone edits a price today. |
| `costAmount` | Decimal? | `quantity × unitCostAtTime`, materialized so reports are a simple `SUM`. |
| `transactionDate` | DateTime | |
| `relatedEntityId` / `relatedEntityType` | String? | Polymorphic link to the cause (`DailyLog`, `Treatment`, `SalesOrderItem`, `ProcessingEvent`). |
| `reversalOfId` | String? | **Unique, self-referencing.** Editing or deleting a daily log emits a compensating `REVERSAL` transaction rather than mutating history. **New.** |
| `notes` | String? | |
| `createdById` | String | FK → `User`. |

### ProcessingEvent

**New table.** Converts a broiler flock's live birds into sellable `PRODUCT` stock at the end of the
45-day cycle. In v1 this step existed in no document — flocks simply reached day 45 and nothing
happened, while sales orders drew on chicken stock that was never created.

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `flockId` | String | FK → `Flock`, unique (one processing event per flock). |
| `processedAt` | DateTime | |
| `birdsProcessed` | Int | Decrements `Flock.currentCount` to 0 and sets status `PROCESSED`. |
| `totalLiveWeightKg` | Decimal | Closes out the broiler FCR calculation. |
| `totalDressedWeightKg` | Decimal? | Post-processing yield. |
| `producedItemId` | String | FK → `InventoryItem` (the `PRODUCT` receiving stock). |
| `unitsProduced` | Decimal | Emits an `IN` / `PRODUCTION` transaction. |
| `createdById` | String | FK → `User`. |

### Customer

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `farmId` | String | FK → `Farm`. |
| `name` | String | |
| `contactEmail`, `contactPhone`, `address` | String? | **PII.** Subject to the retention policy — see [GAPS.md](GAPS.md) G-44. |
| `isActive` | Boolean | Soft delete; customers with order history are never hard-deleted. |

### SalesOrder

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `farmId`, `customerId` | String | FKs. |
| `orderNumber` | String | Human-readable, unique per farm. **New.** |
| `orderDate` | DateTime | |
| `status` | Enum | `DRAFT` \| `PLACED` \| `FULFILLED` \| `CANCELLED`. Now matches BUSINESS_RULES §3 (v1 schema said `PENDING/COMPLETED/CANCELLED`). |
| `subtotal`, `taxAmount`, `totalAmount` | Decimal | Tax was absent from v1 entirely. |
| `currency` | String | Snapshot of `Farm.currency` at order time. |
| `fulfilledAt`, `cancelledAt` | DateTime? | **Stock is deducted at `FULFILLED`, once.** Three documents previously disagreed on when. |
| `createdById` | String | FK → `User`. Makes the "view own orders" rule implementable. **New.** |

### SalesOrderItem

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `salesOrderId` | String | FK → `SalesOrder`, cascade delete. |
| `inventoryItemId` | String | FK → `InventoryItem`. **Not a free-text product name** as the v1 API sent. |
| `sourceFlockId` | String? | FK → `Flock`. Required for the withdrawal check and for traceability. **New.** |
| `productName` | String | Denormalized snapshot. |
| `quantity` | Decimal | In *packages* (e.g. 3 dozen). Stock deduction multiplies by `unitsPerPackage`. |
| `unitPrice`, `subtotal` | Decimal | |

### Invoice

**New table.** v1 generated PDFs on the fly with no record, meaning no invoice number, no issue
date, and no guarantee a regenerated PDF matched what the customer received.

| Column | Type | Notes |
|:---|:---|:---|
| `id` | String | PK. |
| `salesOrderId` | String | FK → `SalesOrder`, unique. |
| `invoiceNumber` | String | Globally unique, sequential, immutable. |
| `issuedAt` | DateTime | |
| `currency`, `totalAmount` | | Frozen at issue. |
| `pdfUrl` | String? | Object-storage location of the rendered artifact. |

### AlertSetting / AlertRecipient / AlertEvent

The v1 design had one farm-wide threshold per alert type with a single recipient email, no history,
and no dedup — so the low-inventory alert would have fired on every daily log submission until the
user muted the sender.

**AlertSetting**

| Column | Type | Notes |
|:---|:---|:---|
| `farmId` | String | FK → `Farm`. |
| `flockId` | String? | FK → `Flock`. **Null = farm-wide default; set = per-flock override.** Production and mortality thresholds are inherently per-flock. **New.** |
| `alertType` | Enum | `PRODUCTION_DROP` \| `MORTALITY_SPIKE` \| `LOW_INVENTORY`. |
| `thresholdValue` | Decimal | |
| `cooldownHours` | Int | Default 24. Suppresses repeat firing of the same condition. **New.** |
| `isActive` | Boolean | |

**AlertRecipient** — many recipients per setting, replacing the single `recipientEmail` string.

**AlertEvent** — the fired-alert history: what triggered, when, the payload, the delivery status, and
a `dedupeKey` (`alertType:scopeId:date`) that the cooldown check reads. Also the backing store for
"active health alerts" on the dashboard.

### GrowthCurve / GrowthCurvePoint

**New tables.** `GET /api/reports/broiler-growth` returned a `targetWeightG` that was stored nowhere
and attributed to no breed. A curve is a named series of `(dayOfCycle, targetWeightG)` points,
seeded per breed and referenced by `Flock.growthCurveId`.

### AuditLog

**New table.** Daily logs are editable and drive financial reporting; without an audit trail there
is no way to answer "who changed last month's feed number and when". Records actor, action, entity,
and a JSON before/after diff.

---

## Invariants

These are enforced by the application layer inside a single database transaction. They are the
rules that v1 stated in prose but wired to nothing.

| # | Invariant |
|:---|:---|
| **I-01** | Writing a `DailyLog` with `mortalityCount > 0` decrements `Flock.currentCount` by the same amount, in the same transaction. |
| **I-02** | `Flock.currentCount >= 0` at all times. A log whose mortality exceeds the current count is rejected with `422`. |
| **I-03** | Writing a `DailyLog` with `feedItemId` set emits exactly one `OUT`/`FEED_CONSUMPTION` transaction and decrements `InventoryItem.currentStock`. |
| **I-04** | **Editing or deleting** a `DailyLog` emits a compensating `REVERSAL` transaction and, if applicable, a fresh consumption transaction. Ledger rows are never mutated or deleted. |
| **I-05** | `InventoryItem.currentStock` always equals `SUM(IN.quantity) - SUM(OUT.quantity)` over its ledger. A nightly reconciliation job asserts this and raises on drift. |
| **I-06** | Stock may go negative **only** for `FEED_CONSUMPTION` and `TREATMENT`, which emit a warning rather than blocking. Real feed bins drift from recorded stock; refusing to record a mortality because the feed number is off is unacceptable. `SALE` may **not** drive stock negative and is rejected with `409`. |
| **I-07** | Every `IN` transaction with a cost recomputes `avgUnitCost = (currentStock × avgUnitCost + quantity × incomingCost) / (currentStock + quantity)`. Every `OUT` snapshots the prevailing `avgUnitCost` into `unitCostAtTime`. |
| **I-08** | Writing a `Treatment` sets `Flock.withdrawalUntil = MAX(existing, treatment.withdrawalUntil)`. |
| **I-09** | Transitioning a `SalesOrder` to `FULFILLED` is rejected with `422 WITHDRAWAL_ACTIVE` if any line item's `sourceFlockId` names a flock whose `withdrawalUntil` is in the future. |
| **I-10** | `SalesOrder → FULFILLED` deducts stock **exactly once**, keyed on `fulfilledAt` being null. Re-fulfilment is a no-op. |
| **I-11** | A `DailyLog` with `eggsCollected` set posts `eggsCollected - crackedEggs - eggsDiscarded` as an `IN`/`PRODUCTION` transaction against the farm's egg `PRODUCT` item. |
| **I-12** | `crackedEggs + eggsDiscarded <= eggsCollected`, and `eggsCollected <= Flock.currentCount` (a hen cannot lay more than one egg per day). |
| **I-13** | `logDate` may not precede `Flock.startDate` and may not be in the future in farm-local time. |
| **I-14** | Deleting a `Flock` is forbidden while dependent logs exist; `DELETE /api/flocks/:id` sets status `ARCHIVED`. |

---

## Derived Metrics

The dashboard and reports depend on formulas that appeared in no document. Defined here because the
columns above exist to serve them; they belong in BUSINESS_RULES.md as well.

| Metric | Formula | Notes |
|:---|:---|:---|
| **Broiler FCR** | `Σ feedConsumedKg / (birdsProcessed × latestAvgWeightG / 1000)` | Cumulative feed over the whole cycle, **including feed eaten by birds that later died** — excluding it flatters the number. Undefined until at least one `WeightRecord` exists. |
| **Layer FCR** | `Σ feedConsumedKg / (Σ sellableEggs / 12)` | kg of feed per dozen sellable eggs. Feed-per-weight-gain is meaningless for layers. |
| **Hen-day %** | `eggsCollected / Flock.currentCount × 100` | Denominator is live hens **at the start of the day**, i.e. `currentCount` before that day's mortality is applied. |
| **Mortality rate (period)** | `Σ mortalityCount over range / Flock.initialCount × 100` | Cumulative against the starting flock. Displayed alongside a daily figure. |
| **Water:feed ratio** | `waterConsumedL / feedConsumedKg` | Normally ~1.8–2.0. A sharp drop is one of the earliest illness indicators in poultry — this is what `waterConsumedL` is *for*. It was collected and unused in v1. |
| **Sellable eggs** | `eggsCollected - crackedEggs - eggsDiscarded` | |
| **Days to processing** | `Flock.cycleLengthDays - (today - startDate)` | Uses the per-flock value, not a hardcoded 45. |

**Production-drop alert edge cases** (undefined in v1): the 7-day average requires **at least 4
logged days** within the trailing 7; below that the alert is skipped rather than firing on thin
data. Missing days are excluded from the average rather than counted as zero.

---

## Prisma Schema

```prisma
// PoultryPilot — schema revision 2
// See DATABASE.md for conventions, invariants, and the v1 → v2 changelog.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ───────────────────────────── Enums ─────────────────────────────

enum UserRole {
  ADMIN
  FARM_WORKER
}

enum UserStatus {
  INVITED
  ACTIVE
  DEACTIVATED
}

enum FlockType {
  LAYER
  BROILER
}

enum FlockStatus {
  ACTIVE
  INACTIVE
  PROCESSED
  ARCHIVED
}

enum BirdStatus {
  ACTIVE
  CULLED
  SOLD
  DECEASED
}

enum InventoryItemType {
  FEED
  MEDICATION
  SUPPLEMENT
  PRODUCT
}

enum TransactionType {
  IN
  OUT
}

enum TransactionReason {
  PURCHASE
  PRODUCTION
  MANUAL_ADJUSTMENT
  FEED_CONSUMPTION
  TREATMENT
  SALE
  SPOILAGE
  REVERSAL
}

enum HealthSeverity {
  MILD
  MODERATE
  SEVERE
}

enum HealthLogStatus {
  OPEN
  RESOLVED
}

enum SalesOrderStatus {
  DRAFT
  PLACED
  FULFILLED
  CANCELLED
}

enum AlertType {
  PRODUCTION_DROP
  MORTALITY_SPIKE
  LOW_INVENTORY
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  SUPPRESSED
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
}

// ───────────────────────────── Identity ─────────────────────────────

model User {
  id          String     @id @default(cuid())
  clerkUserId String     @unique
  email       String     @unique
  name        String
  role        UserRole   @default(FARM_WORKER)
  status      UserStatus @default(INVITED)

  farmId String
  farm   Farm   @relation("FarmMembers", fields: [farmId], references: [id], onDelete: Restrict)

  ownedFarm Farm? @relation("FarmOwner")

  invitedAt   DateTime?
  lastLoginAt DateTime?

  // Attribution back-relations
  dailyLogs        DailyLog[]             @relation("DailyLogAuthor")
  weightRecords    WeightRecord[]         @relation("WeightRecordAuthor")
  healthLogs       HealthLog[]            @relation("HealthLogAuthor")
  treatments       Treatment[]            @relation("TreatmentAuthor")
  invTransactions  InventoryTransaction[] @relation("InvTxnAuthor")
  processingEvents ProcessingEvent[]      @relation("ProcessingAuthor")
  salesOrders      SalesOrder[]           @relation("SalesOrderAuthor")
  auditLogs        AuditLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([farmId, status])
}

model Farm {
  id       String @id @default(cuid())
  name     String
  location String
  timezone String @default("UTC") // IANA name; authority for all day boundaries
  currency String @default("USD") // ISO 4217

  // Nullable to break the bootstrap cycle: Farm is inserted first, then backfilled.
  ownerId String? @unique
  owner   User?   @relation("FarmOwner", fields: [ownerId], references: [id], onDelete: SetNull)

  users          User[]          @relation("FarmMembers")
  flocks         Flock[]
  inventoryItems InventoryItem[]
  customers      Customer[]
  salesOrders    SalesOrder[]
  alertSettings  AlertSetting[]
  alertEvents    AlertEvent[]
  growthCurves   GrowthCurve[]
  auditLogs      AuditLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ───────────────────────────── Flocks ─────────────────────────────

model Flock {
  id     String @id @default(cuid())
  farmId String
  farm   Farm   @relation(fields: [farmId], references: [id], onDelete: Restrict)

  type            FlockType
  name            String
  breed           String?
  initialCount    Int
  currentCount    Int
  startDate       DateTime    @db.Date
  cycleLengthDays Int? // 45 for broilers; null for layers
  status          FlockStatus @default(ACTIVE)

  // Which feed this flock consumes — resolves "deduct from the corresponding feed item"
  defaultFeedItemId String?
  defaultFeedItem   InventoryItem? @relation(fields: [defaultFeedItemId], references: [id], onDelete: SetNull)

  growthCurveId String?
  growthCurve   GrowthCurve? @relation(fields: [growthCurveId], references: [id], onDelete: SetNull)

  // Denormalized max(Treatment.withdrawalUntil); blocks sales while in the future
  withdrawalUntil DateTime?

  birds           Bird[]
  dailyLogs       DailyLog[]
  weightRecords   WeightRecord[]
  healthLogs      HealthLog[]
  processingEvent ProcessingEvent?
  salesOrderItems SalesOrderItem[]
  alertSettings   AlertSetting[]
  alertEvents     AlertEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([farmId, name])
  @@index([farmId, status])
}

model Bird {
  id      String @id @default(cuid())
  flockId String
  flock   Flock  @relation(fields: [flockId], references: [id], onDelete: Cascade)

  tag       String
  status    BirdStatus @default(ACTIVE)
  hatchDate DateTime?  @db.Date
  notes     String?

  healthLogs HealthLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([flockId, tag]) // unique within the flock, not globally
  @@index([flockId, status])
}

// ───────────────────────────── Daily operations ─────────────────────────────

model DailyLog {
  id      String @id @default(cuid())
  flockId String
  flock   Flock  @relation(fields: [flockId], references: [id], onDelete: Restrict)

  logDate DateTime @db.Date

  feedItemId String?
  feedItem   InventoryItem? @relation(fields: [feedItemId], references: [id], onDelete: SetNull)

  feedConsumedKg Decimal @db.Decimal(12, 3)
  waterConsumedL Decimal @db.Decimal(12, 3)
  mortalityCount Int     @default(0)

  eggsCollected Int? // LAYER only
  crackedEggs   Int? // LAYER only
  eggsDiscarded Int? // LAYER only — destroyed under medication withdrawal

  notes String?

  createdById String
  createdBy   User   @relation("DailyLogAuthor", fields: [createdById], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([flockId, logDate])
  @@index([flockId, logDate(sort: Desc)])
}

model WeightRecord {
  id      String @id @default(cuid())
  flockId String
  flock   Flock  @relation(fields: [flockId], references: [id], onDelete: Restrict)

  recordDate DateTime @db.Date
  avgWeightG Decimal  @db.Decimal(12, 2)
  sampleSize Int

  createdById String
  createdBy   User   @relation("WeightRecordAuthor", fields: [createdById], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([flockId, recordDate])
  @@index([flockId, recordDate(sort: Desc)])
}

// ───────────────────────────── Health ─────────────────────────────

model HealthLog {
  id      String @id @default(cuid())
  flockId String
  flock   Flock  @relation(fields: [flockId], references: [id], onDelete: Restrict)

  birdId String?
  bird   Bird?   @relation(fields: [birdId], references: [id], onDelete: SetNull)

  logDate     DateTime
  eventType   String
  severity    HealthSeverity  @default(MILD)
  status      HealthLogStatus @default(OPEN)
  resolvedAt  DateTime?
  description String?

  createdById String
  createdBy   User   @relation("HealthLogAuthor", fields: [createdById], references: [id], onDelete: Restrict)

  treatments Treatment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([flockId, status])
  @@index([flockId, logDate(sort: Desc)])
}

model Treatment {
  id          String    @id @default(cuid())
  healthLogId String
  healthLog   HealthLog @relation(fields: [healthLogId], references: [id], onDelete: Cascade)

  inventoryItemId String
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id], onDelete: Restrict)

  medicationName String // denormalized snapshot
  dosageText     String // as administered, e.g. "10ml/L drinking water"
  quantityUsed   Decimal @db.Decimal(12, 3) // the amount actually deducted from stock
  unit           String
  route          String?

  startDate            DateTime
  endDate              DateTime
  withdrawalPeriodDays Int
  withdrawalUntil      DateTime // endDate + withdrawalPeriodDays; drives the sales block

  createdById String
  createdBy   User   @relation("TreatmentAuthor", fields: [createdById], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([inventoryItemId])
  @@index([withdrawalUntil])
}

// ───────────────────────────── Inventory ─────────────────────────────

model InventoryItem {
  id     String @id @default(cuid())
  farmId String
  farm   Farm   @relation(fields: [farmId], references: [id], onDelete: Restrict)

  name String
  type InventoryItemType
  unit String // stock-keeping unit: "kg", "L", "ml", "egg", "bird"

  unitsPerPackage Int? // sale packaging divisor; eggs = 12

  currentStock     Decimal  @db.Decimal(12, 3)
  avgUnitCost      Decimal  @default(0) @db.Decimal(12, 4) // weighted average
  salePrice        Decimal? @db.Decimal(12, 2) // per package, PRODUCT items only
  reorderThreshold Decimal  @db.Decimal(12, 3)
  isActive         Boolean  @default(true)

  transactions     InventoryTransaction[]
  treatments       Treatment[]
  salesOrderItems  SalesOrderItem[]
  dailyLogs        DailyLog[]
  flocksAsFeed     Flock[]
  processingEvents ProcessingEvent[]
  alertEvents      AlertEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([farmId, name])
  @@index([farmId, type])
}

model InventoryTransaction {
  id              String        @id @default(cuid())
  inventoryItemId String
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id], onDelete: Restrict)

  transactionType TransactionType
  reason          TransactionReason
  quantity        Decimal           @db.Decimal(12, 3) // always positive
  unitCostAtTime  Decimal?          @db.Decimal(12, 4) // snapshot — historical reports stay stable
  costAmount      Decimal?          @db.Decimal(12, 2) // quantity × unitCostAtTime
  transactionDate DateTime

  relatedEntityId   String? // DailyLog.id | Treatment.id | SalesOrderItem.id | ProcessingEvent.id
  relatedEntityType String?

  // Compensating entries: edits and deletes reverse, never mutate.
  reversalOfId String?               @unique
  reversalOf   InventoryTransaction? @relation("TxnReversal", fields: [reversalOfId], references: [id], onDelete: SetNull)
  reversedBy   InventoryTransaction? @relation("TxnReversal")

  notes String?

  createdById String
  createdBy   User   @relation("InvTxnAuthor", fields: [createdById], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())

  @@index([inventoryItemId, transactionDate(sort: Desc)])
  @@index([relatedEntityType, relatedEntityId])
}

model ProcessingEvent {
  id      String @id @default(cuid())
  flockId String @unique
  flock   Flock  @relation(fields: [flockId], references: [id], onDelete: Restrict)

  processedAt          DateTime
  birdsProcessed       Int
  totalLiveWeightKg    Decimal  @db.Decimal(12, 3)
  totalDressedWeightKg Decimal? @db.Decimal(12, 3)

  producedItemId String
  producedItem   InventoryItem @relation(fields: [producedItemId], references: [id], onDelete: Restrict)
  unitsProduced  Decimal       @db.Decimal(12, 3)

  notes String?

  createdById String
  createdBy   User   @relation("ProcessingAuthor", fields: [createdById], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ───────────────────────────── Sales ─────────────────────────────

model Customer {
  id     String @id @default(cuid())
  farmId String
  farm   Farm   @relation(fields: [farmId], references: [id], onDelete: Restrict)

  name         String
  contactEmail String?
  contactPhone String?
  address      String?
  notes        String?
  isActive     Boolean @default(true)

  salesOrders SalesOrder[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([farmId, name])
}

model SalesOrder {
  id     String @id @default(cuid())
  farmId String
  farm   Farm   @relation(fields: [farmId], references: [id], onDelete: Restrict)

  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)

  orderNumber String
  orderDate   DateTime
  status      SalesOrderStatus @default(DRAFT)

  subtotal    Decimal @db.Decimal(12, 2)
  taxAmount   Decimal @default(0) @db.Decimal(12, 2)
  totalAmount Decimal @db.Decimal(12, 2)
  currency    String

  fulfilledAt DateTime? // stock deducts here, exactly once
  cancelledAt DateTime?
  notes       String?

  createdById String
  createdBy   User   @relation("SalesOrderAuthor", fields: [createdById], references: [id], onDelete: Restrict)

  items   SalesOrderItem[]
  invoice Invoice?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([farmId, orderNumber])
  @@index([farmId, status])
  @@index([customerId, orderDate(sort: Desc)])
}

model SalesOrderItem {
  id           String     @id @default(cuid())
  salesOrderId String
  salesOrder   SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)

  inventoryItemId String
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id], onDelete: Restrict)

  // Traceability + the withdrawal-period check
  sourceFlockId String?
  sourceFlock   Flock?  @relation(fields: [sourceFlockId], references: [id], onDelete: SetNull)

  productName String // denormalized snapshot
  quantity    Decimal @db.Decimal(12, 3) // in packages
  unitPrice   Decimal @db.Decimal(12, 2)
  subtotal    Decimal @db.Decimal(12, 2)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([salesOrderId])
}

model Invoice {
  id           String     @id @default(cuid())
  salesOrderId String     @unique
  salesOrder   SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Restrict)

  invoiceNumber String   @unique
  issuedAt      DateTime
  currency      String
  totalAmount   Decimal  @db.Decimal(12, 2)
  pdfUrl        String?

  createdAt DateTime @default(now())
}

// ───────────────────────────── Alerts ─────────────────────────────

model AlertSetting {
  id     String @id @default(cuid())
  farmId String
  farm   Farm   @relation(fields: [farmId], references: [id], onDelete: Cascade)

  // null = farm-wide default; set = per-flock override
  flockId String?
  flock   Flock?  @relation(fields: [flockId], references: [id], onDelete: Cascade)

  alertType      AlertType
  thresholdValue Decimal   @db.Decimal(12, 3)
  cooldownHours  Int       @default(24)
  isActive       Boolean   @default(true)

  recipients AlertRecipient[]
  events     AlertEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // NOTE: Postgres treats NULLs as distinct in unique indexes, so this does not
  // prevent duplicate farm-wide rows. Replace with a raw migration using
  // `UNIQUE NULLS NOT DISTINCT` (Postgres 15+). See GAPS.md G-12.
  @@unique([farmId, flockId, alertType])
}

model AlertRecipient {
  id             String       @id @default(cuid())
  alertSettingId String
  alertSetting   AlertSetting @relation(fields: [alertSettingId], references: [id], onDelete: Cascade)

  email String

  createdAt DateTime @default(now())

  @@unique([alertSettingId, email])
}

model AlertEvent {
  id     String @id @default(cuid())
  farmId String
  farm   Farm   @relation(fields: [farmId], references: [id], onDelete: Cascade)

  alertSettingId String?
  alertSetting   AlertSetting? @relation(fields: [alertSettingId], references: [id], onDelete: SetNull)

  alertType AlertType

  flockId String?
  flock   Flock?  @relation(fields: [flockId], references: [id], onDelete: SetNull)

  inventoryItemId String?
  inventoryItem   InventoryItem? @relation(fields: [inventoryItemId], references: [id], onDelete: SetNull)

  triggeredAt DateTime
  message     String
  payload     Json? // observed value, threshold, window

  // "PRODUCTION_DROP:flock_x:2026-07-20" — the cooldown check reads this
  dedupeKey String

  notificationStatus NotificationStatus @default(PENDING)
  sentAt             DateTime?
  failureReason      String?

  acknowledgedAt DateTime?

  createdAt DateTime @default(now())

  @@unique([dedupeKey])
  @@index([farmId, triggeredAt(sort: Desc)])
  @@index([notificationStatus])
}

// ───────────────────────────── Reference data ─────────────────────────────

model GrowthCurve {
  id     String @id @default(cuid())
  farmId String
  farm   Farm   @relation(fields: [farmId], references: [id], onDelete: Cascade)

  name        String // e.g. "Ross 308 — as-hatched"
  breed       String
  description String?

  points GrowthCurvePoint[]
  flocks Flock[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([farmId, name])
}

model GrowthCurvePoint {
  id            String      @id @default(cuid())
  growthCurveId String
  growthCurve   GrowthCurve @relation(fields: [growthCurveId], references: [id], onDelete: Cascade)

  dayOfCycle   Int
  targetWeightG Decimal @db.Decimal(12, 2)

  @@unique([growthCurveId, dayOfCycle])
}

// ───────────────────────────── Audit ─────────────────────────────

model AuditLog {
  id     String @id @default(cuid())
  farmId String
  farm   Farm   @relation(fields: [farmId], references: [id], onDelete: Cascade)

  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  action     AuditAction
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?

  createdAt DateTime @default(now())

  @@index([farmId, createdAt(sort: Desc)])
  @@index([entityType, entityId])
}
```

---

## Seed Data Required

None of this existed in v1, and the system is non-functional without it:

1. **Farm** with `timezone` and `currency` set.
2. **Growth curves** — at minimum one broiler curve (Ross 308 or Cobb 500, 0–45 days). Without this,
   `GET /api/reports/broiler-growth` has no target series to plot.
3. **`PRODUCT` inventory items** — "Eggs" (`unit: egg`, `unitsPerPackage: 12`) and "Whole Processed
   Chicken" (`unit: bird`, `unitsPerPackage: 1`), each with a `salePrice`. Egg auto-posting (I-11)
   silently no-ops without the egg item.
4. **Default `AlertSetting` rows** for all three alert types, with at least one recipient.

---

## Changelog: v1 → v2

**Fixed — the schema now compiles and can be seeded**

- `User.farm` and `Farm.owner` both declared relation name `"FarmOwner"` while pointing in opposite
  directions, and `Farm.users` had no matching back-relation. Split into `"FarmOwner"` and
  `"FarmMembers"`.
- Circular required FK (`User.farmId` ↔ `Farm.ownerId`) made the first insert impossible.
  `Farm.ownerId` is now nullable.
- `User.password` removed; `clerkUserId` added. Auth is Clerk-only per the stated stack.
- All money columns moved from `Float` to `Decimal`.
- `onDelete` behaviour declared on every relation; v1 had none.

**Added — columns and tables that documented features depended on but that did not exist**

- `InventoryItem.avgUnitCost`, `salePrice`, `unitsPerPackage` — the Cost & Revenue report and all of
  BUSINESS_RULES §4 referenced costs and prices with no column to hold them.
- `Treatment.quantityUsed` — BR-09 required deducting medication with no field naming the amount.
- `DailyLog.feedItemId`, `Flock.defaultFeedItemId` — BR-08 said "the corresponding feed inventory
  item" with nothing establishing correspondence.
- `User.status`, `Bird.notes`, `HealthLog.severity`/`status`/`resolvedAt`, `Treatment.route` — all
  present in the API or user flows, absent from the schema.
- `createdById` on every user-authored entity.
- New tables: `WeightRecord`, `ProcessingEvent`, `Invoice`, `AlertRecipient`, `AlertEvent`,
  `GrowthCurve`, `GrowthCurvePoint`, `AuditLog`.
- `Farm.timezone`, `Farm.currency`, `Flock.cycleLengthDays`, `Flock.breed`.

**Reconciled — one vocabulary across documents**

- `FlockStatus` now `ACTIVE/INACTIVE/PROCESSED/ARCHIVED` (was `ACTIVE/COMPLETED/ARCHIVED`, which
  matched neither BUSINESS_RULES §3 nor the flows).
- `SalesOrderStatus` now `DRAFT/PLACED/FULFILLED/CANCELLED` (was `PENDING/COMPLETED/CANCELLED`).
- `Bird.tag` unique per flock, matching the prose, rather than globally unique.

**Structural**

- `DailyLog.avgWeightG` extracted to `WeightRecord` with `sampleSize`.
- `InventoryTransaction` gained `reason`, `unitCostAtTime`, `costAmount`, and self-referencing
  `reversalOf`, turning it into a real append-only ledger.
- `AlertSetting` gained optional `flockId` scoping and `cooldownHours`; its single `recipientEmail`
  string became the `AlertRecipient` table.
