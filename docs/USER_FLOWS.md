# USER_FLOWS.md: PoultryPilot

> **Revision 2.** Rewritten against [DATABASE.md](DATABASE.md) schema revision 2,
> [BUSINESS_RULES.md](BUSINESS_RULES.md) revision 2, and [API.md](API.md) revision 2. The v1
> document used field names that no longer exist, said SendGrid sent invitations where Clerk does,
> and documented alternative flows for exactly one of its twenty flows *(G-48)*.
>
> Flows are marked **`P1`** where they are in scope for Phase 1 of [ROADMAP.md](ROADMAP.md).

**Conventions used below**

- **Actors** — `Admin`, `Farm Worker`, `System` (background work with no user present).
- Every flow lists **alternative and error paths**, not only the happy path. v1's omission of these
  is why several error states have no design and no copy.
- Calendar dates shown to users are always **farm-local** *(BR-05)*.

---

## 1. Authentication

### 1.1 Sign in · `P1`
**Actors:** Admin, Farm Worker · **Precondition:** Active account

1. User opens PoultryPilot and is shown the sign-in form (Supabase Auth UI or a custom form against
   `supabase.auth.signInWithPassword`).
2. User authenticates.
3. Supabase issues an access token; the app calls `GET /users/me`.
4. The route handler verifies the token, loads the local `User` by `authUserId`, and returns role
   and farm.
5. User lands on the Dashboard.

**Alternatives**

| Condition | Behaviour |
|:---|:---|
| Invalid credentials | Inline error on the form. |
| Email not yet confirmed | "Check your email to finish setting up your account", with a resend action. |
| Local user `DEACTIVATED` | `403`. App shows "Your access has been removed. Contact the farm owner." and signs the user out. |
| Deactivated **mid-session** | The next API call returns `403` and the app signs them out. Status is checked per request, not only at sign-in *(BR-11)*. |
| Network unavailable | Offline notice. The app is online-only *(G-56)*. |

> **The "account still provisioning" state is gone.** Under the previous Clerk design, a user could
> authenticate before the `user.created` webhook landed, which required a retry loop in this flow.
> The Supabase trigger runs in the same transaction as the auth insert, so a session cannot exist
> without its local row.

### 1.2 Sign out · `P1`
User selects Sign Out → `supabase.auth.signOut()` clears the session → redirect to sign-in.

---

## 2. First-Run Setup · `P1`

### 2.1 Farm bootstrap
**Actors:** Admin (first user) · **Trigger:** First sign-in with no farm configured

1. System detects the farm has no `name`, or that the user is the first `ADMIN`.
2. Guided setup, one screen per step, skippable after the first:
   1. **Farm details** — name, location, **timezone**, **currency**.
   2. **First flock** — see 3.1.
   3. **Feed items** — at least one `FEED` inventory item, so daily logs have something to reference.
3. `PATCH /farm`, then the flock and inventory calls.
4. User lands on the Dashboard with a first-run tour *(NFR: onboarding under 5 minutes)*.

**Why timezone and currency come first:** both are effectively immutable afterwards. `PATCH /farm`
refuses a timezone change once daily logs exist, because it would shift every day boundary
retroactively.

**Alternatives**

| Condition | Behaviour |
|:---|:---|
| Admin skips setup | Dashboard shows an empty state with a "Finish setup" prompt. Daily-log entry is disabled until a flock exists. |
| Timezone change attempted later | `422`. Message explains the constraint. |

### 2.2 Empty states
Before data exists, each screen shows what to do rather than an empty table:

| Screen | Empty state |
|:---|:---|
| Dashboard | "No flocks yet — create one to start tracking." |
| Daily Logs | "No flocks available." → link to Flock Management |
| Inventory | "No items yet — add feed to enable consumption tracking." |
| Reports | "Not enough data. Egg production reports need at least 7 days of logs." |

---

## 3. Flock Management · `P1`

### 3.1 Create a flock
**Actors:** Admin

1. Flock Management → **Add Flock**.
2. Form: name, type (`LAYER`/`BROILER`), breed, initial bird count, start date, default feed item,
   growth curve (broiler only).
3. `POST /flocks` → `currentCount` initialises to `initialCount`.
4. Flock appears in the list; user is offered "Log today's data".

**Alternatives**

| Condition | Behaviour |
|:---|:---|
| Duplicate name | `409`. Inline field error. |
| Start date in the future | `400`. Inline error. |
| No feed items exist | Warning, not a block: "No feed item selected — feed consumption will not be tracked." Links to Inventory. *(BR-24)* |
| Broiler with no growth curve | Warning: the Growth Curve report will be unavailable. |

> **Type is immutable** *(BR-02)*. The form states this before submission, because changing it later
> would invalidate every metric computed for the flock.

### 3.2 Change flock status
**Actors:** Admin

1. Flock detail → **Change status**.
2. Only valid transitions are offered *(BR §3.1)* — the UI never shows an invalid target.
3. Confirmation names the consequence: deactivating blocks daily logs; archiving is permanent.
4. `POST /flocks/:id/status`.

**There is no delete.** Flocks with logs are never removed *(I-14)*. The UI offers Archive instead
and says why.

### 3.3 Individual bird tagging *(optional)*
Add, view, edit, and remove tagged birds within a flock. Tags are unique per flock *(BR-17)*.

> **Known limitation** *(G-45)*: mortality is recorded at flock level, so a bird's `status` never
> changes automatically. Tagged birds are useful for health history, not for headcount.

> **Correction (2026-07-21).** §3.1's Add-Flock form previously listed an **"enable individual
> tagging"** field. Removed: the `Flock` model has no such flag, and BR-07 defines tagging as purely
> **additive and optional** — a flock has tagged birds if birds have been added to it, nothing to
> enable. The alternative (adding a `Flock.taggingEnabled` column) was rejected as schema churn for a
> cosmetic gate on an already-optional, inert feature (G-45). Tagging is always available; the flock
> detail screen simply offers "Add bird".

---

## 4. Daily Data Entry · `P1`

### 4.1 Log daily data — Layer
**Actors:** Farm Worker, Admin · **Trigger:** End of day, or dashboard quick action

1. Daily Logs → select the layer flock. Date defaults to **today, farm-local**.
2. System checks for an existing log for that flock and date.
3. Form: eggs collected, cracked eggs, eggs discarded, feed consumed (kg), feed item, water (L),
   mortality, notes.
4. Client-side validation mirrors *(BR §10)* — the user should never need a round-trip to learn that
   cracked eggs exceed collected.
5. `POST /flocks/:id/daily-logs`.
6. System, in one transaction: decrements `currentCount` by mortality; records feed consumption;
   posts sellable eggs to product stock; evaluates alerts.
7. Success, with any **warnings** surfaced inline rather than as failures.

**Alternatives**

| Condition | Behaviour |
|:---|:---|
| Log already exists for that date | `409 DUPLICATE_DAILY_LOG`. Form switches to **edit mode**, pre-filled, with a notice. Never a silent overwrite. |
| Mortality exceeds flock count | `422 MORTALITY_EXCEEDS_FLOCK`. Inline error naming the current count. |
| Flock not `ACTIVE` | `422 FLOCK_INACTIVE`. The flock is not selectable in the first place. |
| No feed item configured | **Saves**, with warning "No inventory deducted." *(BR-24)* |
| Feed exceeds recorded stock | **Saves**, with warning "Layer Feed is now −2.4 kg — check stock." *(BR-38)* |
| No egg product item | **Saves**, with warning that eggs were not added to sellable stock. |
| Flock under withdrawal | Form highlights **eggs discarded** and explains that eggs laid today cannot be sold *(BR-33)*. |
| Date before flock start | `400`. Inline error. |
| Future date | Date picker prevents selection. |

> **The three "saves with a warning" cases are deliberate.** Refusing to record a mortality because
> feed bookkeeping is stale would make the system worse than paper.

### 4.2 Log daily data — Broiler
Identical, minus the egg fields. Average weight is **not** on this form — it is a separate weight
record *(BR-20)*.

### 4.3 Record a weight sample · `P1`
**Actors:** Farm Worker, Admin · **Trigger:** Weekly, or when prompted

1. Flock detail → **Record weight**.
2. Form: date, average weight (g), **sample size**.
3. `POST /flocks/:id/weight-records`.
4. Growth report updates.

Sample size is required: a 3-bird sample and a 50-bird sample are not equivalent evidence *(G-52)*.

**Alternative:** a record already exists for that date → edit mode.

### 4.4 Backfill a missed day · `P1`
**Actors:** Farm Worker, Admin

1. Dashboard shows "2 days missing" with the dates.
2. User selects a date; the standard form opens with that date.
3. Same validation and side effects — **except no alerts fire** *(BR-21, BR-63)*.
4. Form notes: "Backfilled entries do not trigger alerts."

### 4.5 Correct a log · `P1`
**Actors:** Farm Worker (edit), Admin (delete)

1. Open the log from the history list → **Edit**.
2. `PATCH /daily-logs/:id`. System reverses prior inventory movements and re-posts them *(BR-22)*.
3. The change is recorded in the audit log with before/after.

Deletion is Admin-only, requires confirmation naming the consequences, and emits full reversals
*(BR-23)*.

---

## 5. Inventory · `P1`

### 5.1 Add an inventory item
**Actors:** Admin

1. Inventory → **Add item**.
2. Form: name, type (`FEED`/`MEDICATION`/`SUPPLEMENT`/`PRODUCT`), stock-keeping unit, units per
   package, initial stock, initial unit cost, reorder threshold, sale price (`PRODUCT` only).
3. `POST /inventory` — initial stock creates an `IN`/`PURCHASE` transaction, not a direct write.

**Alternatives:** duplicate name → `409` · `PRODUCT` without a sale price → `400`.

> **Unit guidance is shown inline.** Eggs are stocked as `egg` with `unitsPerPackage: 12`, not as
> `dozen` — otherwise collection and sales cannot reconcile *(BR-39)*.

### 5.2 Adjust stock manually
**Actors:** Farm Worker, Admin

1. Item → **Adjust stock**.
2. Form: direction (add/remove), reason, quantity, unit cost (on additions), date, notes.
3. `POST /inventory/:id/transactions`. An addition with a cost recomputes weighted-average cost
   *(BR-41)*.

**Alternative:** a removal driving stock negative → saves with a warning; only *sales* are blocked
*(BR-38)*.

### 5.3 Review the ledger
Item detail shows the running transaction history with reason, quantity, resulting balance, and
author. Costs are hidden from Farm Workers *(BR §2.1)*.

### 5.4 Respond to a low-stock warning · `P1`
1. Dashboard lists items below threshold.
2. User selects one → item detail → **Adjust stock** to record a delivery.
3. The warning clears once stock exceeds the threshold.

---

## 6. Health & Treatment

### 6.1 Record a health event
**Actors:** Farm Worker, Admin

1. Health → **Log event**.
2. Form: date/time, flock, optional bird, event type, **severity**, description.
3. `POST /health-logs`, status `OPEN`.
4. `MODERATE` and `SEVERE` events appear as dashboard alerts; `MILD` do not *(BR-27)*.

### 6.2 Record a treatment
**Actors:** Farm Worker, Admin

1. From the health event → **Add treatment**.
2. Form: medication (**selected from inventory**, not typed), dosage text, **quantity used**, route,
   start and end date, withdrawal period (days).
3. `POST /health-logs/:id/treatments`. Deducts stock; computes withdrawal.
4. **Confirmation states the withdrawal clearance date explicitly** and warns that product from this
   flock cannot be sold until then.

**Alternatives**

| Condition | Behaviour |
|:---|:---|
| Quantity exceeds stock | Saves with a warning *(BR-38)*. |
| End date before start | `400`. |
| Flock already under a longer withdrawal | Saves; the longer date stands *(BR-30)*. |

### 6.3 Resolve a health event
Health event → **Resolve** → `POST /health-logs/:id/resolve`. Reopening is permitted. Resolving does
**not** clear withdrawal — only the treatment governs that *(BR-35)*.

### 6.4 Withdrawal in effect *(new — no v1 equivalent)*
**Actors:** Admin, Farm Worker, System

1. On the first treatment, the flock is flagged as under withdrawal.
2. Dashboard shows a persistent banner: flock name and clearance date *(BR-34)*.
3. Layer daily logs prompt for eggs discarded; sellable-egg posting is suppressed *(BR-33)*.
4. Attempting to fulfil a sale from that flock fails with `422 WITHDRAWAL_ACTIVE`, naming the
   clearance date *(BR-32)*.
5. The flag clears on its own at the clearance date. It is never dismissed manually.

---

## 7. Processing a Broiler Flock

**Actors:** Admin · **Trigger:** Cycle complete — the dashboard countdown reaches zero

1. Dashboard prompts "Broiler Flock 1 is ready for processing."
2. Flock detail → **Record processing**.
3. Form: date, birds processed, total live weight, total dressed weight, product item, units
   produced.
4. `POST /flocks/:id/processing-event`.
5. System sets `currentCount = 0`, status `PROCESSED`, adds product stock, and finalises FCR.
6. Summary: final FCR, mortality rate, total feed, actual vs. target weight.

**Alternatives**

| Condition | Behaviour |
|:---|:---|
| Birds processed ≠ current count | Warning showing the discrepancy; proceeds on confirmation. |
| Flock under withdrawal | **Processing is allowed; selling is not.** The resulting stock inherits the flock's withdrawal date. |
| Layer flock | Not offered. Broiler only *(BR-16)*. |
| Already processed | Not offered. |

> This flow has no v1 counterpart. The countdown reached zero and nothing happened — no document
> described converting live birds into sellable product *(G-09)*.

---

## 8. Sales

### 8.1 Create a sales order
**Actors:** Admin

1. Sales → **New order**. Created as `DRAFT`.
2. Select or create a customer.
3. Add line items: product (from `PRODUCT` inventory), **source flock**, quantity in packages, unit
   price (defaults from sale price, overridable).
4. System shows line subtotals, order subtotal, tax, total.
5. `POST /sales-orders`. **No stock moves.**

**Alternatives:** no line items → cannot leave `DRAFT` · product with insufficient stock → warning at
creation, hard block at fulfilment · source flock under withdrawal → **warning shown at creation**
with the clearance date, so the problem surfaces before fulfilment.

### 8.2 Place and fulfil
1. Order → **Place** (`DRAFT` → `PLACED`; lines freeze).
2. Order → **Fulfil** (`PLACED` → `FULFILLED`). Confirmation states that stock will be deducted.
3. `POST /sales-orders/:id/fulfil` — deducts stock once, recognises revenue *(BR §7.1)*.

**Alternatives**

| Condition | Behaviour |
|:---|:---|
| Withdrawal active | `422 WITHDRAWAL_ACTIVE`, naming flock and clearance date. Order stays `PLACED`. |
| Insufficient stock | `409 INSUFFICIENT_STOCK`, naming the item and shortfall. |
| Already fulfilled | Action not offered. |

**Reversing a fulfilment is not supported in v1.** The UI states this at the confirmation step; the
workaround is a manual inventory adjustment with a note *(BR §7.1)*.

### 8.3 Cancel an order
`DRAFT`/`PLACED` → **Cancel** → terminal. Fulfilled orders cannot be cancelled.

### 8.4 Manage customers
Add, edit, and deactivate. Customers with order history are deactivated, never deleted *(BR-54)*.
Customer detail shows order history.

### 8.5 Issue an invoice
1. Fulfilled order → **Issue invoice**.
2. `POST /sales-orders/:id/invoice` — assigns an immutable invoice number, freezes totals.
3. `GET .../invoice` downloads the PDF.

**Alternative:** already issued → `409`. The existing invoice is offered for download instead. Later
edits to the order do not alter it *(BR-57)*.

---

## 9. Dashboard · `P1`

### 9.1 View the dashboard
**Actors:** Admin, Farm Worker

1. `GET /dashboard/metrics`.
2. Sections: per-flock cards (count, hen-day %, FCR, mortality, water:feed, days to processing);
   today's eggs vs. 7-day average; missing-log prompts; low-stock warnings; active health alerts;
   **withdrawal banners**.
3. Cards link through to detail.

**Role differences** *(BR §2.1)* — Farm Workers see all operational metrics and stock **levels**;
cost, revenue, margin, and unit prices are absent from the response, not merely hidden in the UI.

**States**

| Condition | Display |
|:---|:---|
| No flocks | Empty state → create a flock |
| Metric not computable | "—" with a tooltip, e.g. "FCR available after the first weight record" |
| Fewer than 7 days of data | Average shown as provisional, with the day count |
| Stale data (>24h) | "Last log: 2 days ago" prompt |

### 9.2 Respond to an alert *(new — no v1 equivalent)*
1. Alert appears on the dashboard and, if configured, by email.
2. User selects it → context: which flock or item, observed value, threshold, when.
3. User takes the relevant action (adjust stock, log a health event, review production).
4. User acknowledges the alert → `POST /alert-events/:id/acknowledge`.

Acknowledgement records that a human saw it. It does not resolve the underlying condition, and the
UI says so.

---

## 10. Reports

Common shape: select date range and scope → generate → view chart and table → export CSV or PDF.

| Report | Actors | Scope | Notes |
|:---|:---|:---|:---|
| **Egg production** | Admin, Worker | Layer flock, date range | Daily/weekly/monthly production and hen-day %. Needs ≥7 days. |
| **Broiler growth** | Admin, Worker | One broiler flock | Actual vs. target weight. **`404` if the flock has no growth curve** — the report is meaningless without a target *(G-21)*. |
| **Cost & revenue** | **Admin only** | Date range | Revenue, input cost, **gross margin**. The header states that the cost basis excludes chicks, labour, and utilities *(BR-44, G-43)*. |

**Alternatives:** insufficient data → explanatory empty state naming what is missing · Farm Worker
requesting cost & revenue → not shown in navigation; `403` if reached directly.

---

## 11. Administration

### 11.1 Invite a Farm Worker · `P1`
**Actors:** Admin

1. Users → **Invite user**.
2. Form: email, name, role (`FARM_WORKER`).
3. `POST /users/invitations` → **Supabase Auth** sends the invitation with role and farm in
   `raw_user_meta_data` *(BR-09)*.
4. The user appears in the list as `INVITED`. **No local `User` row exists yet.**
5. On acceptance, the trigger on `auth.users` creates the local row as `ACTIVE`, in the same
   transaction.

> v1 said SendGrid in `API.md` and Clerk in `USER_FLOWS.md`; a later revision chose Clerk *(G-04)*.
> The platform then moved to Supabase, so **Supabase Auth sends it**. SendGrid remains alert-only.

**Alternatives:** already invited or registered → `409` with an option to resend · invitation expires
→ shown as `EXPIRED`, resendable.

### 11.2 Deactivate a user · `P1`
1. Users → select → **Deactivate**. Confirmation explains that their logs are retained.
2. `POST /users/:id/deactivate` — status change, never deletion *(BR-11)*.

**Alternatives:** deactivating the sole Admin → blocked, explained *(BR-12)* · reactivation restores
access with the same role.

### 11.3 Configure alerts
1. Settings → Alerts. Each row: type, scope (farm-wide or a specific flock), threshold, cooldown
   hours, recipients, active.
2. Add per-flock overrides; edit thresholds; add or remove recipients.

> Thresholds are per row, resolving flock-first *(BR-58)*. Low-inventory thresholds live on the
> **inventory item**, not here — the v1 duplicate settings screen is gone *(G-31)*.

### 11.4 Review the audit log
Admin only. Filter by entity, user, and date. Read-only; entries are never edited or deleted
*(BR-65)*.

---

## Cross-Cutting Behaviours

**Validation** — client-side rules mirror [BUSINESS_RULES §10](BUSINESS_RULES.md). The server is
authoritative; the client exists so users learn about problems before submitting.

**Warnings vs. errors** — errors block and are shown against the field. Warnings appear after a
successful save, are dismissible, and never discard input.

**Connectivity** — the app is online-only *(G-56)*. On a failed submission the form retains all
input and offers retry. Data is never silently discarded.

**Concurrency** — two users editing the same daily log: the second save returns `409` with a diff
and a choice to reload or overwrite.

**Destructive actions** — deletion, archiving, fulfilment, and processing all require confirmation
that names the specific consequence, not a generic "Are you sure?".

---

## Open Items

| Gap | Issue |
|:---|:---|
| ~~G-24~~ | ~~Low-stock sweep needs a scheduler~~ — **closed**: `pg_cron` ships with Supabase. |
| **G-42** | No vaccination scheduling flow. Health logging is entirely reactive. |
| **G-45** | Tagged birds have no automatic status changes. |
| **G-53–G-55** | The onboarding tour, empty states, and error states described here have no visual design yet. |
| **G-56** | Online-only conflicts with field data entry in a poultry house. Unresolved. |
