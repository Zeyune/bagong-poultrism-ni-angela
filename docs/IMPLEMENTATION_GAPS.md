# IMPLEMENTATION_GAPS.md — implementation-vs-spec audit (Steps 3–5)

> **What this is.** A point-in-time audit of the *built code* (auth, audit trail, flocks/birds —
> Steps 3–5) against the *specification documents*. It is deliberately **separate from
> [GAPS.md](GAPS.md)**: GAPS.md catalogues contradictions *between the spec documents*; this file
> catalogues where the *implementation* diverges from, under-delivers, or has not yet met the spec.
>
> **Purpose.** Effie is running an independent review to verify these findings. Nothing here has been
> fixed — it is logged as-found so it can be checked. Each item has a stable ID (`IMPL-xx`), a
> severity, the spec reference, and a `file:line` code reference to confirm against.
>
> **Audited:** 2026-07-21. **Method:** three parallel reviewers (auth, audit-trail, API conventions)
> reading spec + code, plus a GAPS.md cross-pass. **Not run:** `prisma validate` and live SQL
> execution — correctness of the Prisma schema and the trigger SQL is by inspection only (the repo's
> standing caveat).
>
> **Verdict:** no High-severity holes in what is built. Steps 3–5 conform to spec. The items below are
> Medium/Low/latent/informational.

---

## Severity key

- **Medium** — a documented contract/requirement is unmet, but not yet on a live user path.
- **Low** — a convention deviation or robustness gap.
- **Latent** — correct for what is built today; will become a real gap when a later step adds the path.
- **Info** — noted for completeness; not a spec violation.

---

## Findings

### IMPL-01 · `sort` query parameter is ignored on every list endpoint — **Medium**
- **Spec:** API.md §3.1 — "`sort` | all lists | `field:asc|desc`".
- **Code:**
  - `src/app/api/v1/flocks/route.ts` GET — hardcodes `orderBy: [{ status: "asc" }, { createdAt: "desc" }]`.
  - `src/app/api/v1/flocks/[id]/birds/route.ts` GET — hardcodes `orderBy: { tag: "asc" }`.
  - `src/app/api/v1/audit-logs/route.ts:45` — hardcodes `orderBy: { createdAt: "desc" }`.
- **Gap:** all three parse `page`/`limit` but never read `sort`; a client-supplied `sort` is silently
  dropped. Affects the Step 6 lists too once they exist.
- **Fix direction:** a shared `parseSort()` helper mapping `field:asc|desc` to Prisma `orderBy`, with a
  per-endpoint allowlist of sortable fields.

### IMPL-02 · Invalid enum filter returns 500 instead of 400 — **Low**
- **Spec:** API.md §3.1 (`status`/`type` are "enum member") and §3.2 (400 `VALIDATION_ERROR` for
  malformed parameters).
- **Code:** `src/app/api/v1/flocks/route.ts` GET — `where.status = status as FlockStatus` /
  `where.type = type as FlockType` cast the raw query string with no validation.
- **Gap:** `?status=BOGUS` reaches Prisma, throws, and falls through `handleRouteError` to a generic
  500 `INTERNAL_ERROR` instead of 400 `VALIDATION_ERROR`. (The audit-logs string filters are free-text
  columns, so unaffected.)

### IMPL-03 · AuditLog immutability is convention-only, not enforced — **Medium**
- **Spec:** BR-65 / FR-13.4 — audit rows are "immutable and never deleted".
- **Code:** `prisma/schema.prisma` (AuditLog model, ~626–645); `src/lib/db.ts:61–86` (audit extension);
  `src/app/api/v1/audit-logs/route.ts` (GET only — correct).
- **Gap:** the absence of a mutation route is real, but nothing prevents
  `db.auditLog.update(...)` / `.delete(...)` from server code. RLS-with-no-policies blocks only the
  anon Data API (G-65), not the service-role connection Prisma uses. So "immutable" is currently
  *unimplemented*, not *prevented*.
- **Fix direction:** a `BEFORE UPDATE OR DELETE ON "AuditLog"` trigger that `RAISE`s — a table trigger
  fires even for the table owner/superuser (unlike RLS), so it enforces immutability against all app
  paths.

### IMPL-04 · Audit trigger uses a hardcoded allowlist — **Medium (latent)**
- **Spec:** BR-64 / FR-13 — "*every* create, update, delete on a business entity".
- **Code:** `supabase/sql/040_audit_trigger.sql:92–94` —
  `audited := array['User','Farm','Flock','Bird','DailyLog','WeightRecord','InventoryItem','InventoryTransaction']`.
- **Status:** **All Phase 1 business tables are covered** (including Step 6/7 tables — verified).
  The *omitted* models are Phase 2+ only: `HealthLog`, `Treatment`, `ProcessingEvent`, `Customer`,
  `SalesOrder`, `SalesOrderItem`, `Invoice`, `AlertSetting`, `AlertRecipient`, `AlertEvent`.
- **Latent gap:** the G-71 instruction ("re-run after adding a table") is insufficient — the script's
  `information_schema` check only *skips missing* tables, it does not *discover new* ones. A Phase 2
  table added to the schema is **not** audited until someone hand-edits this array.
- **Fix direction:** invert to an exclude-list (audit every `public` table except reference/audit
  ones), so new tables are audited by default.
- **Correction to the raw reviewer output:** one reviewer described this as "omits most business
  entities", which is misleading — it omits only *not-yet-built Phase 2* entities. Phase 1 is complete.

### IMPL-05 · `AuditLog.farmId` uses `onDelete: Cascade` — **Low (latent)**
- **Spec:** BR-65 — audit rows "never deleted".
- **Code:** `prisma/schema.prisma` — `farm Farm @relation(fields:[farmId], references:[id], onDelete: Cascade)`.
- **Gap:** deleting a `Farm` would cascade-delete its entire audit trail, contradicting "never
  deleted". No farm-delete flow exists today, so latent. `Restrict` would be safer.

### IMPL-06 · `AuditLog.userId` uses `onDelete: SetNull` — **Low (latent)**
- **Spec:** FR-13.2 / BR-65 — an audit row must still resolve to its actor after the actor is removed.
- **Code:** `prisma/schema.prisma` — `user User? @relation(fields:[userId], references:[id], onDelete: SetNull)`.
- **Status:** the *tested* path (deactivation = `status` change, not row delete) is correct — `userId`
  stays intact. A *hard* `User` delete would null `userId` and lose identity. No user hard-delete flow
  exists, so latent. Flagged because the schema choice, not deactivation, is what would break FR-13.2
  if such a flow is added.

### IMPL-07 · `AuditLog.ipAddress` is a dead column — **Low**
- **Code:** `prisma/schema.prisma` has `ipAddress String?`; the trigger INSERT
  (`supabase/sql/040_audit_trigger.sql`) never sets it, and no path supplies it.
- **Status:** not required by BR-64 (actor/action/entity/before/after only), so not a violation —
  noted as an unused column to either populate or remove.

### IMPL-08 · `/health` returns 503 with error code `INTERNAL_ERROR` — **Low (intentional)**
- **Code:** `src/app/api/v1/health/route.ts` — on DB failure returns `fail("INTERNAL_ERROR", …, { status: 503 })`.
- **Status:** API.md §3.2 does not define 503 and maps `INTERNAL_ERROR`→500, so a client reading
  `error.code` sees `INTERNAL_ERROR` against a 503. Intentional and in-code-documented; `/health` is a
  keep-alive endpoint, not part of the API.md contract. Not a violation — noted for the reviewer.

### IMPL-09 · Sign-in page omits two USER_FLOWS alternative paths — **Low (deferred)**
- **Spec:** USER_FLOWS.md §1 — "email not yet confirmed → resend action" and "DEACTIVATED → show
  message and sign the user out".
- **Code:** `src/app/sign-in/page.tsx` — renders the raw `signInError.message` only; no resend or
  deactivated-sign-out handling.
- **Status:** the file is explicitly acknowledged scaffolding (comment in the component; DESIGN.md has
  no screens — G-54). Out of scope for Step 3 rather than a true gap; flagged for completeness.

### IMPL-10 · BR-64 says "before/after JSON diff"; implementation stores full snapshots — **Info**
- **Code:** `supabase/sql/040_audit_trigger.sql` writes full-row `before`/`after` JSONB, not a
  computed field-level diff.
- **Status:** both requested values are present (satisfies FR-13.1). Treated as an acceptable
  interpretation, not a gap. Noted so the reviewer can decide if a literal field-diff is wanted.

---

## Stale GAPS.md statuses (this session's work changed them)

### IMPL-11 · G-45 (individual bird tracking "half-built") is now partially closed
- **GAPS.md G-45** (status ⬜) lists "no delete" and half-built tagging. **As of 2026-07-21, bird
  `PATCH`/`DELETE` (`/birds/:id`) and edit/remove UI exist** (API.md §6.1). Remaining: no dedicated
  *bird detail screen*, and `Bird.status` stays inert (by design — mortality is flock-level, G-45's
  own premise). G-45's status line is now stale and should be updated to reflect edit/remove shipped.

### IMPL-12 · G-76 (User.id generation inconsistency) is effectively benign
- The trigger uses `gen_random_uuid()` (`supabase/sql/020_auth_trigger.sql:51`) and the schema uses
  `@default(uuid()) @db.Uuid` (`prisma/schema.prisma:109`) — both produce UUIDs. The "inconsistency"
  is two codepaths, both yielding valid `@db.Uuid` values. LOW; effectively resolved in practice.

---

## Verified conformant (checked, no gap)

**Auth (Step 3 / FR-10 part 1):** JWKS/ES256 verification with no shared secret (`require-user.ts`,
`proxy.ts`); BR-11 per-request status check re-read from DB (`resolve-user.ts`); status-code mapping
401/403 (`respond.ts`); `GET /users/me` at `Auth` level; `requireAdmin` runs BR-11 before the role
check; sign-out clears cookies + 303; session refresh performs no authorization; `/health` issues a
real `SELECT 1`.

**Audit (Step 4 / FR-13):** single atomic `AFTER` trigger, per-row, `SECURITY DEFINER`, same-transaction
`AuditLog` write with full before/after; actor via transaction-local GUCs (correct for the pooler,
I-15); all Phase 1 tables audited; FR-13.1/13.2/13.3/13.4 satisfiable; `GET /audit-logs` Admin-only,
read-only, farm-scoped, with `entityType`/`entityId`/`userId`/date filters and pagination.

**API conventions (§3):** success/error/paginated envelopes exact; `warnings: []` always present on
success; `page`/`limit` defaults (1 / 20, max 100) correct; pagination shape
`{totalItems,totalPages,currentPage,itemsPerPage}` exact; all 13 built handlers' auth levels match the
API.md tables; status codes 201/204/400/401/403/404/409/422 used correctly.

**Flocks/birds (Step 5 / FR-01):** create/list/get/patch/status + birds add/list/edit/remove; the state
machine matches BR §3.1; `type`/`currentCount` immutable; no flock DELETE (I-14); uniqueness → 409;
feed-item/growth-curve fields + future-date validation (added 2026-07-21). 35 Vitest tests.

---

## Known-open gaps, deferred by design (from GAPS.md — not implementation misses)

- **G-65** (RLS lockdown — enforced continuously via `test:rls`, verified) and **G-66** (custom SMTP)
  — must close before real data / launch (Step 9).
- **G-67, G-68, G-69, G-70, G-72, G-73, G-74, G-75** — deployment/ops (preview isolation, backups,
  `pg_cron` tz, licensing, secrets inventory, project count, rate limiting, cold-start measurement) —
  Step 9.
- These are not in scope for Steps 3–5 and are correctly open.
