# BUSINESS_RULES.md: PoultryPilot

> **Revision 2.** Rewritten against [DATABASE.md](DATABASE.md) schema revision 2. The v1 document
> contradicted the schema on status vocabularies, referenced fields that did not exist, and stated
> rules that were wired to nothing. See [CHANGELOG.md](../CHANGELOG.md) for what changed and why, and
> [GAPS.md](GAPS.md) for the issues this closes.
>
> **Authority order:** `DATABASE.md` defines structure and invariants. This document defines logic
> and policy. `API.md` defines the transport. Where they disagree, `DATABASE.md` wins and the
> disagreement is a bug to be logged.

---

## 1. Scope & Configuration

| ID | Rule |
|:---|:---|
| **BR-01** | The system manages **one farm**. Multi-tenancy is out of scope. Every scoped entity carries `farmId`, so the constraint is enforced by query filter, not by schema shape. |
| **BR-02** | Two flock types exist: `LAYER` (eggs) and `BROILER` (meat). Type is set at creation and **immutable** — daily-log shape, metrics, and lifecycle all branch on it. |
| **BR-03** | Initial deployment manages one `LAYER` flock (50 birds) and one `BROILER` flock (50 birds). This is seed data, not a system limit. |
| **BR-04** | Broiler cycle length is **per-flock** (`Flock.cycleLengthDays`), defaulting to 45. v1 hardcoded 45; the field exists because breeds and market weights differ. |
| **BR-05** | `Farm.timezone` (IANA) is the sole authority for every calendar-day boundary: "today", the daily-log uniqueness key, the 24-hour mortality window, and all report ranges. Never use server-local time. |
| **BR-06** | `Farm.currency` (ISO 4217) denominates every money value. There is no multi-currency support and no FX conversion. |
| **BR-07** | Bird tracking defaults to **flock-level aggregation**. Individual `Bird` records are optional and additive — no metric or report depends on them. |

---

## 2. Identity & Access

| ID | Rule |
|:---|:---|
| **BR-08** | Authentication is **Supabase Auth**. The local `User` table is a projection keyed by `authUserId` → `auth.users.id`; it stores no credentials. *(Supersedes the Clerk decision — the platform moved to Vercel + Supabase.)* |
| **BR-09** | Farm Worker invitations are issued through **Supabase Auth's invite flow** (`inviteUserByEmail`). Supabase generates the token, sends the email, and enforces expiry. SendGrid is used **only** for farm alerts. *(Resolves G-04 — v1 said SendGrid in `API.md` and Clerk in `USER_FLOWS.md`; both are now wrong, and this is the single answer.)* ⚠️ **Requires custom SMTP.** Supabase's default mail service sends 2 messages/hour and refuses addresses outside the project team, so this rule is unimplementable until SMTP is configured *(G-66)*. |
| **BR-10** | Role and `farmId` are written into the invitation's `raw_user_meta_data` and projected into the local `User` row by a **Postgres trigger on `auth.users`**, in the same transaction as the auth insert. There is no webhook and no window in which a user is authenticated but has no local row. `auth.users` is the source of truth for identity; `public.User` is the source of truth for authorisation. |
| **BR-11** | Deactivation is a **status change** (`ACTIVE` → `DEACTIVATED`) on `public.User`, not a delete, and not a change to `auth.users`. Authored records must retain a valid `createdById`. Hard deletion of a user who has authored anything is forbidden. A deactivated user may still hold a valid Supabase session, so **`status` is checked on every request**, not only at sign-in. |
| **BR-12** | The farm owner (`Farm.ownerId`) cannot be deactivated or demoted while they are the sole `ADMIN`. |

### 2.1 Role access policy

| Capability | Admin | Farm Worker |
|:---|:---:|:---:|
| Create / edit daily logs, weight records | ✅ | ✅ |
| Create / edit health logs and treatments | ✅ | ✅ |
| Delete any record | ✅ | ❌ |
| View dashboard: production, mortality, FCR, growth | ✅ | ✅ |
| View dashboard: cost, revenue, profit | ✅ | ❌ |
| View inventory stock levels and low-stock warnings | ✅ | ✅ (read-only) |
| View inventory **costs** and unit prices | ✅ | ❌ |
| Manual inventory adjustment | ✅ | ✅ |
| Create / edit inventory items, thresholds | ✅ | ❌ |
| Flock create / edit / archive | ✅ | ❌ |
| Sales, customers, invoices | ✅ | ❌ |
| Cost & Revenue report | ✅ | ❌ |
| User management, alert configuration | ✅ | ❌ |
| Audit log | ✅ | ❌ |

> **v1 contradiction resolved.** The v1 policy granted Farm Workers "view own created sales orders"
> while the sales flow was Admin-only and `SalesOrder` had no author column. Farm Workers have no
> sales access at all. `SalesOrder.createdById` still exists, for audit. *(G-15)*

> **Financial data is defined as** unit costs, sale prices, order totals, revenue, and profit. Stock
> *quantities* are operational, not financial — a worker who cannot see that feed is running out
> cannot do their job.

> ### 🔴 This table is enforceable only if the Data API is locked down
>
> Supabase serves every table over PostgREST using the public `anon` key. Until RLS is enabled on
> all tables *(G-65)*, **every rule above is bypassable** by reading the anon key out of the browser
> bundle and querying `/rest/v1/` directly. The application-layer checks are one door, not the only
> one. See [DATABASE.md § Row Level Security](DATABASE.md#-row-level-security--required-not-optional).

---

## 3. Flock Lifecycle

### 3.1 Status transitions

| From | Event | To | Side effects |
|:---|:---|:---|:---|
| — | Admin creates flock | `ACTIVE` | `currentCount = initialCount`. |
| `ACTIVE` | Admin deactivates | `INACTIVE` | Daily logs rejected. Existing data read-only. |
| `INACTIVE` | Admin reactivates | `ACTIVE` | Logging resumes. |
| `ACTIVE` | Processing recorded (broiler only) | `PROCESSED` | `currentCount → 0`; produces `PRODUCT` stock; closes FCR. Irreversible. |
| `INACTIVE` / `PROCESSED` | Admin archives | `ARCHIVED` | Terminal. Hidden from active views; retained for reporting. |

`ARCHIVED` is terminal. There is no transition out of it, and no flock is ever hard-deleted while
logs reference it *(I-14)*.

### 3.2 Rules

| ID | Rule |
|:---|:---|
| **BR-13** | `Flock.currentCount` is **maintained by the system**, never entered directly. It decrements on mortality *(I-01)*, on bird culls, and to zero on processing. |
| **BR-14** | `currentCount` may never go negative. A daily log whose `mortalityCount` exceeds it is rejected *(I-02)*. |
| **BR-15** | `currentCount` may exceed `initialCount` if birds are added. **The v1 rule "current ≤ initial" was wrong** and is withdrawn. |
| **BR-16** | Only `BROILER` flocks may have a `ProcessingEvent`, at most one, and only from `ACTIVE`. |
| **BR-17** | Individual `Bird` tags are unique **within a flock**, not globally. |

---

## 4. Daily Data Entry

| ID | Rule |
|:---|:---|
| **BR-18** | Exactly **one daily log per flock per calendar day** in farm-local time. A second submission for the same day is a conflict, not a duplicate — the client must edit the existing log. |
| **BR-19** | `LAYER` logs capture eggs collected, cracked eggs, eggs discarded, feed (kg), water (L), and mortality. |
| **BR-20** | `BROILER` logs capture feed (kg), water (L), and mortality. Average weight is **not** part of the daily log — it is a separate `WeightRecord`, typically weekly, carrying a `sampleSize`. |
| **BR-21** | Logs may be **backfilled** for any date on or after `Flock.startDate` and not in the future. Backfilled logs trigger inventory movement normally but **do not** fire alerts — an alert about a condition three days stale is noise. |
| **BR-22** | Editing a log **reverses** its prior inventory movements and re-posts them *(I-04)*. Ledger rows are never mutated or deleted. |
| **BR-23** | Deleting a log is Admin-only and emits full reversals. |
| **BR-24** | Feed consumption deducts from `DailyLog.feedItemId`, defaulted from `Flock.defaultFeedItemId`. If neither is set, the log still saves and **no** inventory movement occurs — a warning is returned. Blocking a mortality record because feed tracking is unconfigured is unacceptable. *(Resolves G-05.)* |
| **BR-25** | Sellable eggs = `eggsCollected − crackedEggs − eggsDiscarded`, posted as an `IN` / `PRODUCTION` transaction against the farm's egg `PRODUCT` item *(I-11)*. If no egg product item exists, the log saves and a warning is returned. |

---

## 5. Health, Treatment & Withdrawal

| ID | Rule |
|:---|:---|
| **BR-26** | A health event targets a flock, and optionally an individual bird. It opens as `OPEN` and is resolved explicitly (`OPEN` ⇄ `RESOLVED`; reopening is permitted). |
| **BR-27** | Open health events of severity `MODERATE` or `SEVERE` surface as active dashboard alerts. `MILD` events do not. |
| **BR-28** | A treatment must reference an `InventoryItem` of type `MEDICATION` or `SUPPLEMENT` and record `quantityUsed`, which deducts from stock *(I-03)*. Free-text medication names are not accepted. |
| **BR-29** | `Treatment.withdrawalUntil = endDate + withdrawalPeriodDays`, computed and stored on write. |
| **BR-30** | `Flock.withdrawalUntil = MAX` of all its treatments' withdrawal ends *(I-08)*. It is never lowered by deleting a treatment — recompute from the surviving set instead. |

### 5.1 Withdrawal enforcement *(G-10 — the rule v1 recorded and never applied)*

| ID | Rule |
|:---|:---|
| **BR-31** | While `Flock.withdrawalUntil` is in the future, the flock is **under withdrawal**. |
| **BR-32** | Fulfilling a sales order containing a line item whose `sourceFlockId` is under withdrawal is **rejected** with `422 WITHDRAWAL_ACTIVE` *(I-09)*. The order may be created and held as `DRAFT`/`PLACED`; only fulfilment is blocked. |
| **BR-33** | While a `LAYER` flock is under withdrawal, its daily log **prompts for `eggsDiscarded`**, and sellable-egg auto-posting *(BR-25)* is suppressed for that day. Eggs laid under withdrawal do not enter sellable stock. |
| **BR-34** | The dashboard displays an active withdrawal banner naming the flock and the clearance date. |
| **BR-35** | Withdrawal status is never auto-cleared early. Only correcting or removing the underlying treatment changes it. |

> **Why this is enforced rather than advisory:** every other rule in this document protects a number.
> This one protects a person. Medicated product reaching a customer is a regulatory and health
> failure, and the withdrawal period is the only control against it.

---

## 6. Inventory & Costing

### 6.1 Stock

| ID | Rule |
|:---|:---|
| **BR-36** | `InventoryTransaction` is an **append-only ledger**. `InventoryItem.currentStock` is a cached projection of it *(I-05)*, reconciled nightly. |
| **BR-37** | Corrections are **compensating `REVERSAL` entries**, never edits or deletes. |
| **BR-38** | Stock may go negative **only** for `FEED_CONSUMPTION` and `TREATMENT`, which warn rather than block. Real feed bins drift from recorded stock. `SALE` may **not** drive stock negative and is rejected with `409 INSUFFICIENT_STOCK` *(I-06)*. |
| **BR-39** | Items are stocked in their **stock-keeping unit** (eggs in `egg`, not `dozen`). `unitsPerPackage` converts to sale units. A 3-dozen sale deducts 36. |
| **BR-40** | Items are deactivated (`isActive = false`), never deleted, once any transaction references them. |

### 6.2 Costing — weighted average *(G-07)*

| ID | Rule |
|:---|:---|
| **BR-41** | Every `IN` transaction with a cost recomputes: `avgUnitCost = (currentStock × avgUnitCost + qtyIn × costIn) ÷ (currentStock + qtyIn)` *(I-07)*. |
| **BR-42** | Every `OUT` transaction **snapshots** the prevailing `avgUnitCost` into `unitCostAtTime` and materialises `costAmount = quantity × unitCostAtTime`. |
| **BR-43** | Historical cost reports read `costAmount` only. Editing an item's price today **never** changes a past report. This is the point of the snapshot. |
| **BR-44** | `PRODUCT` items produced by the farm (eggs, processed birds) enter at **zero cost**. v1 has no cost-of-production allocation; feed and medication are expensed on consumption. Consequence: the Cost & Revenue report measures *cash cost of inputs vs. sales*, not true margin. |

### 6.3 Pricing

| ID | Rule |
|:---|:---|
| **BR-45** | `InventoryItem.salePrice` is the default price **per package** for `PRODUCT` items. |
| **BR-46** | Line price defaults from `salePrice` and **may be overridden** per order. The override is stored on the line; the item's price is unchanged. |
| **BR-47** | `lineSubtotal = quantity × unitPrice`; `orderSubtotal = Σ lineSubtotal`; `totalAmount = orderSubtotal + taxAmount`. |
| **BR-48** | Tax is entered per order as an absolute amount. There is **no tax rate configuration** in v1 and prices are treated as tax-exclusive. *(Open — G-27.)* |
| **BR-49** | Rounding is half-up to the currency's minor unit, applied at the line, then summed. Never round the total independently of its lines. |

---

## 7. Sales

### 7.1 Status transitions

| From | Event | To | Side effects |
|:---|:---|:---|:---|
| — | Create | `DRAFT` | No stock movement. Freely editable. |
| `DRAFT` | Place | `PLACED` | Lines frozen. Still no stock movement. |
| `PLACED` | Fulfil | `FULFILLED` | **Stock deducts here, exactly once** *(I-10)*. Blocked by withdrawal *(BR-32)*. Revenue recognised. Invoice can issue. Sets `fulfilledAt`. |
| `DRAFT` / `PLACED` | Cancel | `CANCELLED` | No stock movement, no revenue. Terminal. |

`FULFILLED` is terminal in v1. Reversing a fulfilment requires a credit note, which is not in scope —
the workaround is a manual `IN` adjustment with a note.

> **v1 contradiction resolved.** Deduction was specified at three different points across three
> documents (order creation, "Fulfilled", and directly via a `status: "Completed"` POST). It happens
> once, on the transition into `FULFILLED`. *(G-28)*

### 7.2 Rules

| ID | Rule |
|:---|:---|
| **BR-50** | An order requires a customer and **at least one line item** to leave `DRAFT`. |
| **BR-51** | Line items reference `inventoryItemId`, not a free-text product name *(G-29)*. `productName` is a denormalised snapshot for historical reporting. |
| **BR-52** | `sourceFlockId` is **required** on a line item whose product originates from a flock. It drives the withdrawal check and traceability. |
| **BR-53** | Revenue is recognised at `FULFILLED`, on `fulfilledAt`. `DRAFT`, `PLACED`, and `CANCELLED` orders contribute nothing to reports. |
| **BR-54** | Customers with order history are deactivated, never deleted. |

### 7.3 Invoicing

| ID | Rule |
|:---|:---|
| **BR-55** | An invoice may be issued only for a `FULFILLED` order, **at most once**. *(v1 said "Completed" in one place and "Fulfilled" in another.)* |
| **BR-56** | `invoiceNumber` is sequential, globally unique, and immutable. Gaps are not backfilled. |
| **BR-57** | Invoice totals are **frozen at issue**. Later edits to the order do not alter an issued invoice. |

---

## 8. Alerts

### 8.1 Rules

| ID | Rule |
|:---|:---|
| **BR-58** | Thresholds resolve **per flock first, then farm-wide**: an `AlertSetting` with a matching `flockId` overrides the farm default. |
| **BR-59** | Every alert writes an `AlertEvent` **before** dispatch. The event is the record; the email is a delivery attempt. |
| **BR-60** | A `dedupeKey` of `alertType:scopeId:localDate` plus `cooldownHours` (default 24) suppresses repeat firing. Without this the low-inventory alert re-fires on every log until the user mutes the sender *(G-23)*. |
| **BR-61** | Suppressed conditions still write an `AlertEvent` with status `SUPPRESSED`, so the dashboard stays accurate while the inbox stays quiet. |
| **BR-62** | Delivery failure sets `FAILED` with a reason and does **not** roll back the event. Alerts are visible in-app regardless of email outcome. |
| **BR-63** | Backfilled logs *(BR-21)* do not evaluate alerts. |

### 8.2 Triggers

**Production drop** — evaluated on `LAYER` daily-log write.

- Compares the day's **sellable** eggs against the mean of the trailing 7 days' sellable eggs.
- Fires when the drop exceeds the threshold (default 15%).
- **Requires at least 4 logged days** in the trailing 7. Below that the check is skipped. Missing
  days are excluded from the mean, never counted as zero. *(v1 defined none of this — as written, day
  two of a flock's life fired an alert. G-22.)*

**Mortality spike** — evaluated on any daily-log write.

- Fires when `mortalityCount` for the flock within a rolling 24 hours, farm-local, exceeds the
  threshold (default 2).

**Low inventory** — evaluated on any stock movement **and** on a scheduled daily sweep.

- Fires when `currentStock < reorderThreshold` for an active item.
- The scheduled sweep is required because stock can sit below threshold for days without any write
  occurring. *(This depends on a scheduler that does not yet exist in the stack — G-24.)*

---

## 9. Derived Metrics

Every one of these was referenced by the dashboard or a report in v1 and defined nowhere. *(G-20)*

| Metric | Formula | Notes |
|:---|:---|:---|
| **Sellable eggs** | `eggsCollected − crackedEggs − eggsDiscarded` | The basis for production reporting and the drop alert. |
| **Hen-day %** | `eggsCollected ÷ currentCountAtDayStart × 100` | Denominator is live hens **before** that day's mortality. Capped at 100 for display; a value above 100 indicates a data error and is flagged. |
| **Layer FCR** | `Σ feedConsumedKg ÷ (Σ sellableEggs ÷ 12)` | kg of feed per dozen sellable eggs. Feed-per-weight-gain is meaningless for layers. |
| **Broiler FCR** | `Σ feedConsumedKg ÷ (birdsProcessed × latestAvgWeightG ÷ 1000)` | Cumulative feed **includes feed eaten by birds that later died** — excluding it flatters the ratio. Undefined until a `WeightRecord` exists; provisional before processing, final after. |
| **Mortality rate (period)** | `Σ mortalityCount ÷ initialCount × 100` | Cumulative against the starting flock. |
| **Mortality rate (daily)** | `mortalityCount ÷ currentCountAtDayStart × 100` | |
| **Water : feed ratio** | `waterConsumedL ÷ feedConsumedKg` | Normally ~1.8–2.0. A sharp drop is among the earliest illness indicators in poultry. This is what `waterConsumedL` is *for* — v1 collected it and used it nowhere *(G-41)*. |
| **Days to processing** | `cycleLengthDays − (today − startDate)` | Per-flock, not a hardcoded 45. |
| **Total cost (period)** | `Σ costAmount` over `OUT` transactions in range | Feed, medication, supplements only. **Excludes** chicks, labour, utilities, bedding *(G-43)*. |
| **Total revenue (period)** | `Σ totalAmount` over orders `FULFILLED` in range | |
| **Gross margin** | `revenue − cost` | **Must not be labelled "Net Profit"** — the cost side omits most real farm costs. |

---

## 10. Validation Rules

Enforced at both the API boundary and the database. Types match [DATABASE.md](DATABASE.md).

**Flock** — `name` unique per farm, non-empty · `type` ∈ {`LAYER`,`BROILER`}, immutable ·
`initialCount` ≥ 1 · `startDate` not in the future · `cycleLengthDays` ≥ 1 when set.

**Daily log** — `logDate` not future (farm-local) and ≥ `Flock.startDate` · unique per flock/day ·
`feedConsumedKg` ≥ 0 · `waterConsumedL` ≥ 0 · `mortalityCount` ≥ 0 and ≤ `currentCount` ·
`eggsCollected` ≥ 0 and ≤ `currentCount` *(a hen lays at most one egg per day — the most obvious
domain check, absent from v1)* · `crackedEggs + eggsDiscarded` ≤ `eggsCollected` · egg fields
rejected on `BROILER` flocks.

**Weight record** — `avgWeightG` > 0 · `sampleSize` ≥ 1 and ≤ `currentCount` · unique per
flock/date · `BROILER` flocks only.

**Health log** — `logDate` not future · `severity` and `status` valid enum members · `birdId`, when
present, must belong to the named flock.

**Treatment** — `inventoryItemId` must be `MEDICATION` or `SUPPLEMENT` · `quantityUsed` > 0
*(v1 typed dosage as a string and validated it as a positive decimal — G-50)* · `endDate` ≥
`startDate` · `withdrawalPeriodDays` ≥ 0.

**Inventory item** — `name` unique per farm · `unit` non-empty · `reorderThreshold` ≥ 0 ·
`avgUnitCost` ≥ 0 · `unitsPerPackage` ≥ 1 when set · `salePrice` > 0 required for `PRODUCT`.

**Inventory transaction** — `quantity` > 0 always; direction comes from `transactionType`, never
from a negative quantity.

**Sales order** — `orderDate` not future · ≥ 1 line item to leave `DRAFT` · `quantity` > 0 ·
`unitPrice` ≥ 0 (zero permitted for samples and donations) · `taxAmount` ≥ 0.

**Alert setting** — `PRODUCTION_DROP` threshold in (0, 100] · `MORTALITY_SPIKE` threshold ≥ 1
integer · `LOW_INVENTORY` uses the item's own `reorderThreshold` · `cooldownHours` ≥ 1.

---

## 11. Audit

| ID | Rule |
|:---|:---|
| **BR-64** | Every create, update, and delete on a business entity writes an `AuditLog` row with actor, action, entity, and a before/after JSON diff. |
| **BR-65** | Audit rows are immutable and are never deleted, including when their actor is deactivated. |
| **BR-66** | Daily logs are editable and drive financial reporting. Without audit there is no answer to *"who changed last month's feed figure"* — which is the top risk named in the PRD. *(G-16)* |

---

## Open Items

Carried from [GAPS.md](GAPS.md); none block Phase 1.

| Gap | Issue |
|:---|:---|
| **G-24** | Low-inventory sweep needs a scheduler. None exists in the stack. |
| **G-27** | No tax-rate configuration; tax is a manual per-order amount. |
| **G-42** | No vaccination scheduling. Health logging is entirely reactive. |
| **G-43** | No expense entity — chicks, labour, utilities, bedding are all unmodelled. |
| **G-44** | Customer PII has no retention or deletion policy. |
| **G-45** | Individual bird tracking is inert: mortality is flock-level, so `Bird.status` never changes. |
