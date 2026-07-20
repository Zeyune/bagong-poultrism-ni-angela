# API.md: PoultryPilot

> **Revision 2.** Rewritten against [DATABASE.md](DATABASE.md) schema revision 2 and
> [BUSINESS_RULES.md](BUSINESS_RULES.md) revision 2. The v1 contract used field names and enum
> values that matched no column, documented no auth failures, and specified no query parameters —
> it could not be implemented. See [GAPS.md](GAPS.md) G-30 through G-39.
>
> Endpoints are marked **`P1`** where they are in scope for Phase 1 of [ROADMAP.md](ROADMAP.md).

---

## 1. Conventions

**Base URL** — `/api/v1`, served by Next.js Route Handlers on the same Vercel deployment as the
frontend. There is no separate backend host. The version is in the path; v1 is the only version.
*(v1 of this document had no versioning at all — G-39.)*

**Naming** — JSON fields are `camelCase` and **match the Prisma column names exactly**. Where the v1
contract and the schema disagreed, the schema wins:

| v1 sent | Correct |
|:---|:---|
| `initialBirdCount` | `initialCount` |
| `currentBirdCount` | `currentCount` |
| `currentQuantity` | `currentStock` |
| `tagId` | `tag` |
| `averageWeightG` | `avgWeightG` |
| `"Layer"`, `"Farm Worker"` | `"LAYER"`, `"FARM_WORKER"` |

**Enums** are transmitted as their exact schema members in `SCREAMING_SNAKE_CASE`. Never
title-case, never localised. Clients display; the wire carries identifiers.

**Decimals are strings.** Every `Decimal` column — money, costs, quantities — is serialised as a
JSON string (`"5.250"`), never a JSON number. IEEE-754 cannot represent decimal fractions exactly,
and `totalAmount` passing through a JavaScript `number` is how invoice totals stop matching their
line items. Integer columns remain JSON numbers.

**Dates and times**

| Kind | Format | Example |
|:---|:---|:---|
| Calendar day (`@db.Date`) | `YYYY-MM-DD`, **farm-local** | `"2026-07-20"` |
| Instant | RFC 3339 UTC | `"2026-07-20T13:45:00Z"` |

Calendar days are always interpreted in `Farm.timezone`. A client in another timezone sending
"today" gets the farm's today, not its own *(BR-05)*.

**IDs** are opaque `cuid` strings. Never parse or order by them.

---

## 2. Authentication & Authorization

Supabase Auth issues the JWT; the route handler verifies it and enforces RBAC.

```http
Authorization: Bearer <supabase_access_token>
```

Each request verifies the token against the Supabase JWT secret, extracts the `auth.users` UUID from
`sub`, loads the local `User` by `authUserId`, and rejects the request if the user is missing or
`status != ACTIVE`.

> **The status check runs on every request, not only at sign-in** *(BR-11)*. Supabase access tokens
> remain valid until they expire, so a user deactivated mid-session still holds a working token.
> Checking only at sign-in would leave a removed worker with up to an hour of continued access.

**Auth levels used below**

| Level | Meaning |
|:---|:---|
| `Auth` | Any active user. |
| `Worker+` | `FARM_WORKER` or `ADMIN`. |
| `Admin` | `ADMIN` only. |

Financial fields (`avgUnitCost`, `salePrice`, `unitPrice`, `totalAmount`, revenue, margin) are
**stripped from responses** for `FARM_WORKER`, not merely hidden in the UI *(BR §2.1)*.

### 2.1 User provisioning — no endpoint · **`P1`**

Local `User` rows are created by a **Postgres trigger on `auth.users`**, not by an HTTP callback.
See [DATABASE.md § Supabase Integration](DATABASE.md#supabase-integration) for the trigger.

| Event | Mechanism |
|:---|:---|
| User accepts an invitation | Trigger inserts `public.User` with `role` and `farmId` from `raw_user_meta_data`, `status = ACTIVE`, in the same transaction. |
| Email or name changes | Trigger on `auth.users` update syncs the projection. |
| User removed from `auth.users` | Local row is **not** deleted; `status` becomes `DEACTIVATED` *(BR-11)*. |

> **This replaces the Clerk webhook the previous revision specified** *(G-30)*. The webhook needed
> signature verification, retry handling, and idempotency, and could arrive after the user had
> already authenticated — which forced a retry state into the sign-in flow. A trigger is
> transactional, so none of that exists.

---

## 3. Response Format

**Success**
```json
{ "success": true, "data": { }, "message": "Optional", "warnings": [] }
```

**`warnings`** is new and load-bearing. Several operations succeed while something notable did not
happen — a daily log saved with no feed item configured, or one that drove stock negative. These are
not errors and must not fail the request *(BR-24, BR-38)*.

```json
{
  "success": true,
  "data": { "id": "log_7fa", "logDate": "2026-07-20" },
  "warnings": [
    { "code": "NO_FEED_ITEM", "message": "Flock has no feed item configured; no inventory was deducted." },
    { "code": "STOCK_NEGATIVE", "message": "Layer Feed 16% is now -2.400 kg.", "detail": { "inventoryItemId": "inv_f1" } }
  ]
}
```

**Error**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description.",
    "details": [ { "field": "mortalityCount", "message": "Cannot exceed current flock count (48)." } ]
  }
}
```

**Paginated**
```json
{
  "success": true,
  "data": [ ],
  "pagination": { "totalItems": 143, "totalPages": 8, "currentPage": 1, "itemsPerPage": 20 }
}
```

### 3.1 Query parameters

v1 documented none — report endpoints took "a specified period" with no way to express it *(G-35)*.

| Parameter | Applies to | Notes |
|:---|:---|:---|
| `page` | all lists | 1-based, default `1` |
| `limit` | all lists | default `20`, max `100` |
| `sort` | all lists | `field:asc\|desc`, e.g. `logDate:desc` |
| `startDate` / `endDate` | dated lists, all reports | `YYYY-MM-DD`, farm-local, **inclusive** |
| `flockId` | logs, health, reports | |
| `status` | flocks, orders, health logs | enum member |
| `type` | flocks, inventory | enum member |

Ranges are inclusive at both ends. `startDate` without `endDate` means "from then to today".

### 3.2 Status codes

v1 listed only `200`/`201`/`400`/`404` — no auth failure, on a system whose stated security
requirement is RBAC on every route *(G-34)*.

| Code | Meaning |
|:---|:---|
| `200` / `201` / `204` | OK / Created / Deleted |
| `400` `VALIDATION_ERROR` | Malformed body or parameters |
| `401` `UNAUTHENTICATED` | Missing, expired, or invalid token |
| `403` `FORBIDDEN` | Authenticated but role lacks permission |
| `404` `NOT_FOUND` | Absent, or outside the caller's farm |
| `409` `CONFLICT` | State conflict — see codes below |
| `422` `UNPROCESSABLE` | Well-formed but violates a business rule |
| `429` `RATE_LIMITED` | Throttled |
| `500` `INTERNAL_ERROR` | Unhandled; correlation ID in `message` |

**Domain-specific codes**

| Code | Status | Raised when |
|:---|:---|:---|
| `DUPLICATE_DAILY_LOG` | `409` | A log exists for that flock and date *(BR-18)* |
| `INSUFFICIENT_STOCK` | `409` | A sale would drive stock negative *(BR-38)* |
| `WITHDRAWAL_ACTIVE` | `422` | Fulfilment blocked by withdrawal *(BR-32)* |
| `INVALID_STATE_TRANSITION` | `422` | e.g. fulfilling a `DRAFT` order |
| `FLOCK_INACTIVE` | `422` | Logging against a non-`ACTIVE` flock |
| `MORTALITY_EXCEEDS_FLOCK` | `422` | `mortalityCount > currentCount` *(BR-14)* |
| `INVOICE_ALREADY_ISSUED` | `409` | Second invoice for one order *(BR-55)* |

### 3.3 Concurrency

Writes that move stock run in a single transaction with `SELECT … FOR UPDATE` row locks on the
affected `InventoryItem` and `Flock` *(I-15)*. **Advisory locks must not be used** — they do not
survive Supabase's transaction-mode pooler. Mutating endpoints accept an optional
`Idempotency-Key` header; a repeat within 24 hours returns the original response rather than acting
twice.

---

## 4. Users · `P1`

| Method | Path | Auth | Notes |
|:---|:---|:---|:---|
| `GET` | `/users/me` | `Auth` | Current user with role and farm. |
| `GET` | `/users` | `Admin` | Paginated. Filter `status`, `role`. |
| `GET` | `/users/:id` | `Admin` | |
| `POST` | `/users/invitations` | `Admin` | Issues a **Supabase Auth** invitation *(BR-09)*. |
| `PATCH` | `/users/:id` | `Admin` | `role` only. Email and name are owned by `auth.users`. |
| `POST` | `/users/:id/deactivate` | `Admin` | Status change, not deletion *(BR-11)*. |
| `POST` | `/users/:id/reactivate` | `Admin` | |

**`POST /users/invitations`**
```json
{ "email": "worker@farm.com", "name": "Ana Cruz", "role": "FARM_WORKER" }
```
→ `201`. Calls `supabase.auth.admin.inviteUserByEmail(email, { data: { role, farmId, name } })`
using the **service-role key**, which must never reach the client. **No local `User` row is created
here** — that happens when the invitee accepts and the trigger fires.
Returns `{ "email": "...", "status": "INVITED", "invitedAt": "..." }`.

`DELETE /users/:id` does not exist. Deactivation is the only removal *(BR-11)*.

---

## 5. Farm · `P1`

| Method | Path | Auth | Notes |
|:---|:---|:---|:---|
| `GET` | `/farm` | `Auth` | The single farm. No `:id` — v1 had no farm endpoints at all despite a "Farm Settings" flow *(G-36)*. |
| `PATCH` | `/farm` | `Admin` | `name`, `location`, `timezone`, `currency`. |

Changing `timezone` shifts every calendar-day boundary and is refused with `422` once daily logs
exist.

---

## 6. Flocks · `P1`

| Method | Path | Auth | Notes |
|:---|:---|:---|:---|
| `POST` | `/flocks` | `Admin` | |
| `GET` | `/flocks` | `Auth` | Filter `status`, `type`. |
| `GET` | `/flocks/:id` | `Auth` | Includes `currentCount`, `withdrawalUntil`, `daysToProcessing`. |
| `PATCH` | `/flocks/:id` | `Admin` | `type` is immutable *(BR-02)*. `currentCount` is **not** writable *(BR-13)*. |
| `POST` | `/flocks/:id/status` | `Admin` | `{ "status": "INACTIVE" }`. Validates the transition *(BR §3.1)*. |

**`POST /flocks`**
```json
{
  "name": "Layer Flock 1",
  "type": "LAYER",
  "breed": "Lohmann Brown",
  "initialCount": 50,
  "startDate": "2026-07-01",
  "cycleLengthDays": null,
  "defaultFeedItemId": "inv_f1",
  "growthCurveId": null
}
```
→ `201`. `currentCount` initialises to `initialCount`.

There is no `DELETE`. Archiving is a status transition, and flocks with logs are never removed
*(I-14)*.

### 6.1 Birds — optional individual tracking

| Method | Path | Auth |
|:---|:---|:---|
| `POST` | `/flocks/:id/birds` | `Admin` |
| `GET` | `/flocks/:id/birds` | `Auth` |
| `GET` / `PATCH` / `DELETE` | `/birds/:id` | `Auth` / `Admin` / `Admin` |

`tag` is unique **within the flock** *(BR-17)*. `status` accepts only `ACTIVE`, `CULLED`, `SOLD`,
`DECEASED` — v1 sent `"Healthy"`, which is not a member of the enum *(G-33)*.

---

## 7. Daily Logs · `P1`

| Method | Path | Auth | Notes |
|:---|:---|:---|:---|
| `POST` | `/flocks/:id/daily-logs` | `Worker+` | Moves inventory; may return warnings. |
| `GET` | `/flocks/:id/daily-logs` | `Auth` | `startDate`, `endDate`, `sort`. |
| `GET` | `/daily-logs/:id` | `Auth` | |
| `PATCH` | `/daily-logs/:id` | `Worker+` | **Reverses and re-posts** inventory *(BR-22)*. |
| `DELETE` | `/daily-logs/:id` | `Admin` | Emits full reversals *(BR-23)*. |

**`POST` — layer**
```json
{
  "logDate": "2026-07-20",
  "feedItemId": "inv_f1",
  "feedConsumedKg": "5.200",
  "waterConsumedL": "10.500",
  "mortalityCount": 1,
  "eggsCollected": 45,
  "crackedEggs": 3,
  "eggsDiscarded": 0,
  "notes": null
}
```

**`POST` — broiler** — same, omitting the three egg fields. Sending them to a `BROILER` flock is
`400`. Average weight is **not** here; it is a separate `WeightRecord` *(BR-20)*.

Side effects, all in one transaction: decrement `Flock.currentCount` by mortality *(I-01)*; emit
`OUT`/`FEED_CONSUMPTION` against `feedItemId` *(I-03)*; emit `IN`/`PRODUCTION` for sellable eggs
*(I-11)*; evaluate alerts unless backfilled *(BR-63)*.

Common failures: `409 DUPLICATE_DAILY_LOG` · `422 MORTALITY_EXCEEDS_FLOCK` · `422 FLOCK_INACTIVE` ·
`400` for a future `logDate` or one before `startDate`.

### 7.1 Weight records · `P1`

| Method | Path | Auth |
|:---|:---|:---|
| `POST` | `/flocks/:id/weight-records` | `Worker+` |
| `GET` | `/flocks/:id/weight-records` | `Auth` |
| `PATCH` / `DELETE` | `/weight-records/:id` | `Worker+` / `Admin` |

```json
{ "recordDate": "2026-07-20", "avgWeightG": "1820.00", "sampleSize": 10 }
```
`BROILER` only. Unique per flock and date.

---

## 8. Health & Treatments

| Method | Path | Auth |
|:---|:---|:---|
| `POST` `GET` | `/health-logs` | `Worker+` / `Auth` |
| `GET` `PATCH` | `/health-logs/:id` | `Auth` / `Worker+` |
| `POST` | `/health-logs/:id/resolve` | `Worker+` |
| `DELETE` | `/health-logs/:id` | `Admin` |
| `POST` `GET` | `/health-logs/:id/treatments` | `Worker+` / `Auth` |
| `PATCH` `DELETE` | `/treatments/:id` | `Worker+` / `Admin` |

Treatments are a **sub-resource**, not inline fields. v1's `POST /health-logs` embedded a single
treatment, which the `1—N` schema could not express and which made a second treatment
unrepresentable *(G-32)*.

**`POST /health-logs`**
```json
{
  "flockId": "flock_l1", "birdId": null,
  "logDate": "2026-07-20T08:30:00Z",
  "eventType": "Coccidiosis observed",
  "severity": "MODERATE",
  "description": "Blood in droppings, 3 birds lethargic."
}
```

**`POST /health-logs/:id/treatments`**
```json
{
  "inventoryItemId": "inv_m1",
  "dosageText": "10ml/L drinking water",
  "quantityUsed": "150.000",
  "route": "ORAL",
  "startDate": "2026-07-20T09:00:00Z",
  "endDate": "2026-07-24T09:00:00Z",
  "withdrawalPeriodDays": 7
}
```
Deducts `quantityUsed` from stock *(I-03)*, computes `withdrawalUntil = endDate + 7d`, and raises
`Flock.withdrawalUntil` *(I-08)*. The response includes the resulting `withdrawalUntil` so the client
can warn immediately.

`quantityUsed` is what v1 lacked entirely, making the documented medication deduction
unimplementable *(G-06)*.

---

## 9. Inventory · `P1`

| Method | Path | Auth | Notes |
|:---|:---|:---|:---|
| `POST` | `/inventory` | `Admin` | |
| `GET` | `/inventory` | `Auth` | Filter `type`, `lowStock=true`. Costs stripped for workers. |
| `GET` | `/inventory/:id` | `Auth` | |
| `PATCH` | `/inventory/:id` | `Admin` | `currentStock` is **not** writable — use a transaction. |
| `POST` | `/inventory/:id/deactivate` | `Admin` | Never deleted *(BR-40)*. |
| `POST` | `/inventory/:id/transactions` | `Worker+` | Manual adjustment. |
| `GET` | `/inventory/:id/transactions` | `Auth` | The ledger. `startDate`, `endDate`. |

**`POST /inventory`**
```json
{
  "name": "Layer Feed 16%", "type": "FEED", "unit": "kg",
  "unitsPerPackage": null, "reorderThreshold": "100.000",
  "initialStock": "500.000", "initialUnitCost": "0.6500", "salePrice": null
}
```
v1 omitted `type` — a required enum — from its request body *(G-38)*. `initialStock` seeds an
`IN`/`PURCHASE` transaction; it is not a writable column.

**`POST /inventory/:id/transactions`**
```json
{ "transactionType": "IN", "reason": "PURCHASE", "quantity": "250.000",
  "unitCost": "0.6800", "transactionDate": "2026-07-20", "notes": "Delivery #4471" }
```
`IN` with a cost recomputes `avgUnitCost` *(I-07)*. `OUT` snapshots it. Quantity is always positive;
direction comes from `transactionType`.

`/config/inventory-thresholds` from v1 is **removed** — it duplicated `PATCH /inventory/:id` and took
the id in the body rather than the path *(G-31)*.

---

## 10. Processing

| Method | Path | Auth |
|:---|:---|:---|
| `POST` | `/flocks/:id/processing-event` | `Admin` |
| `GET` | `/flocks/:id/processing-event` | `Auth` |

```json
{
  "processedAt": "2026-08-15T06:00:00Z",
  "birdsProcessed": 48,
  "totalLiveWeightKg": "110.400",
  "totalDressedWeightKg": "78.200",
  "producedItemId": "inv_p2",
  "unitsProduced": "48.000"
}
```

Sets `currentCount = 0` and status `PROCESSED`, emits `IN`/`PRODUCTION` for the product, and
finalises broiler FCR. `BROILER` only, once per flock, from `ACTIVE` *(BR-16)*.

This endpoint exists because no v1 document contained any step converting live birds into sellable
product — the 45-day countdown reached zero and nothing happened *(G-09)*.

---

## 11. Customers & Sales

| Method | Path | Auth |
|:---|:---|:---|
| `POST` `GET` | `/customers` | `Admin` |
| `GET` `PATCH` | `/customers/:id` | `Admin` |
| `POST` | `/customers/:id/deactivate` | `Admin` |
| `POST` `GET` | `/sales-orders` | `Admin` |
| `GET` `PATCH` | `/sales-orders/:id` | `Admin` |
| `POST` | `/sales-orders/:id/place` | `Admin` |
| `POST` | `/sales-orders/:id/fulfil` | `Admin` |
| `POST` | `/sales-orders/:id/cancel` | `Admin` |
| `POST` `GET` | `/sales-orders/:id/invoice` | `Admin` |

**`POST /sales-orders`** — creates as `DRAFT`. No stock movement.
```json
{
  "customerId": "cust_001",
  "orderDate": "2026-07-20",
  "taxAmount": "0.00",
  "items": [
    { "inventoryItemId": "inv_p1", "sourceFlockId": "flock_l1", "quantity": "3.000", "unitPrice": "4.50" },
    { "inventoryItemId": "inv_p2", "sourceFlockId": "flock_b1", "quantity": "1.000", "unitPrice": "20.00" }
  ]
}
```
Line items carry `inventoryItemId`, not the free-text `product` string v1 sent — which could neither
be FK'd nor deducted *(G-29)*. `unitPrice` defaults from `salePrice` when omitted *(BR-46)*.

**State transitions** are explicit endpoints, not `PATCH { status }`. Each validates the transition
and runs its side effects *(BR §7.1)*:

- **`/place`** — `DRAFT` → `PLACED`. Freezes lines.
- **`/fulfil`** — `PLACED` → `FULFILLED`. **Deducts stock exactly once** *(I-10)*, multiplying
  package quantity by `unitsPerPackage`. Recognises revenue.
- **`/cancel`** — `DRAFT`/`PLACED` → `CANCELLED`.

`POST /fulfil` failures:

```json
{ "success": false, "error": {
    "code": "WITHDRAWAL_ACTIVE",
    "message": "Layer Flock 1 is under medication withdrawal until 2026-08-03.",
    "details": [ { "field": "items[0].sourceFlockId",
                   "message": "Flock flock_l1 clears withdrawal on 2026-08-03." } ] } }
```
→ `422`. Also `409 INSUFFICIENT_STOCK`, and `422 INVALID_STATE_TRANSITION` from the wrong state.

**Invoice** — `POST` issues once for a `FULFILLED` order and returns the record;
`GET .../invoice` returns `application/pdf`. Second issue is `409 INVOICE_ALREADY_ISSUED`
*(BR-55)*.

---

## 12. Dashboard & Reports

| Method | Path | Auth | Phase |
|:---|:---|:---|:---|
| `GET` | `/dashboard/metrics` | `Auth` | **`P1`** |
| `GET` | `/reports/egg-production` | `Auth` | |
| `GET` | `/reports/broiler-growth` | `Auth` | |
| `GET` | `/reports/cost-revenue` | `Admin` | |
| `GET` | `/reports/:report/export` | per report | `?format=csv\|pdf` |

**`GET /dashboard/metrics`**
```json
{ "success": true, "data": {
  "asOf": "2026-07-20",
  "eggs": { "today": 45, "sellableToday": 42, "sevenDayAvg": "41.60", "changePct": "0.95" },
  "flocks": [
    { "flockId": "flock_l1", "name": "Layer Flock 1", "type": "LAYER",
      "currentCount": 48, "henDayPct": "93.75", "fcr": "2.15",
      "mortalityRatePct": "4.00", "waterFeedRatio": "1.94",
      "withdrawalUntil": null },
    { "flockId": "flock_b1", "name": "Broiler Flock 1", "type": "BROILER",
      "currentCount": 47, "fcr": "1.78", "mortalityRatePct": "6.00",
      "waterFeedRatio": "1.86", "daysToProcessing": 15,
      "withdrawalUntil": "2026-08-03" }
  ],
  "lowInventory": [ { "inventoryItemId": "inv_f1", "name": "Layer Feed 16%",
                      "currentStock": "82.500", "reorderThreshold": "100.000" } ],
  "activeHealthAlerts": 1,
  "activeWithdrawals": 1
} }
```

Metrics are **per flock**, not scalar as in v1 — a single `mortalityRate` for a farm with two flocks
of different species is not a meaningful number. All formulas are defined in
[BUSINESS_RULES.md §9](BUSINESS_RULES.md); v1 defined none of them *(G-20)*. `fcr` is `null` until
computable.

**`GET /reports/broiler-growth?flockId=...`** returns actual against target from the flock's
`GrowthCurve` *(G-21)*:
```json
{ "success": true, "data": {
  "flockId": "flock_b1", "breed": "Ross 308", "curveName": "Ross 308 — as-hatched",
  "points": [ { "dayOfCycle": 7,  "avgWeightG": "190.00", "targetWeightG": "200.00", "sampleSize": 10 },
              { "dayOfCycle": 14, "avgWeightG": "455.00", "targetWeightG": "470.00", "sampleSize": 10 } ] } }
```
`404 NOT_FOUND` if the flock has no `growthCurveId` — the report is meaningless without a target.

**`GET /reports/cost-revenue`** returns `totalRevenue`, `totalCost`, `grossMargin`, and a
`costBasis` note. The field is **`grossMargin`, not `netProfit`** — the cost side covers feed,
medication, and supplements only, and omits chicks, labour, and utilities. Labelling it profit would
mislead *(BR-44, G-43)*.

---

## 13. Alerts

| Method | Path | Auth |
|:---|:---|:---|
| `GET` `POST` | `/alert-settings` | `Admin` |
| `PATCH` `DELETE` | `/alert-settings/:id` | `Admin` |
| `GET` | `/alert-events` | `Auth` |
| `POST` | `/alert-events/:id/acknowledge` | `Auth` |

Settings are **rows**, not a singleton config blob. Each has an optional `flockId` for per-flock
override, a `thresholdValue`, `cooldownHours`, and a recipient list *(BR-58)*:

```json
{ "alertType": "MORTALITY_SPIKE", "flockId": "flock_b1",
  "thresholdValue": "3", "cooldownHours": 24, "isActive": true,
  "recipients": ["owner@farm.com", "vet@example.com"] }
```

v1 had one farm-wide threshold per type with a single recipient email and no history — so production
and mortality thresholds could not be set per flock, and the low-inventory alert would have re-fired
on every daily log *(G-23, G-25)*.

`GET /alert-events` is the fired-alert history, filterable by `alertType`, `notificationStatus`, and
date. It also backs the dashboard's active-alert counts.

---

## 14. Reference & Audit

| Method | Path | Auth | Notes |
|:---|:---|:---|:---|
| `GET` `POST` | `/growth-curves` | `Auth` / `Admin` | With `points[]`. |
| `GET` `PATCH` `DELETE` | `/growth-curves/:id` | `Auth` / `Admin` / `Admin` | |
| `GET` | `/audit-logs` | `Admin` | Filter `entityType`, `entityId`, `userId`, dates. Read-only *(BR-65)*. |

---

## Phase 1 Surface

Everything marked **`P1`**, consolidated for planning:

| Group | Endpoints |
|:---|:---|
| Users | `me`, list, get, invitations, patch, deactivate, reactivate |
| Farm | `GET`, `PATCH` |
| Flocks | create, list, get, patch, status · birds sub-resource |
| Daily logs | create, list, get, patch, delete |
| Weight records | create, list, patch, delete |
| Inventory | create, list, get, patch, deactivate, transactions (create + list) |
| Dashboard | `GET /dashboard/metrics` |

Deferred to Phase 2+: health logs and treatments, processing, customers and sales, invoices,
reports, alert settings and events, growth curves, audit log.

Inventory is in Phase 1 per the **G-12** decision: item CRUD, thresholds, manual adjustment, and
low-stock warnings ship in Phase 1; automatic deduction from daily logs, the full ledger with
reversals, and weighted-average costing move to Phase 2. Phase 1's `POST /daily-logs` therefore
accepts `feedItemId` and stores it, but does **not** yet emit inventory transactions.

---

## Open Items

| Gap | Issue |
|:---|:---|
| ~~G-24~~ | ~~Low-inventory sweep needs a scheduler~~ — **closed**: `pg_cron` ships with Supabase. |
| **G-27** | No tax-rate configuration; `taxAmount` is a manual per-order figure. |
| **G-43** | No expense endpoints — `grossMargin` covers input costs only. |
| **G-44** | Customer PII has no retention, export, or deletion endpoint. |
| — | Rate-limit thresholds for `429` are not yet specified. |
