# ROADMAP.md: PoultryPilot

## Phased Delivery Plan

This roadmap outlines a phased approach to deliver the PoultryPilot Farm Management System. The timeline assumes a dedicated team of 2 developers (1 Frontend, 1 Backend/Fullstack). Adjust proportionally for different team sizes.

| Phase | Duration | Goals |
|:---|:---|:---|
| **Phase 1: Foundation & Core Data** | 5-7 Weeks | Establish core infrastructure. Implement user authentication and basic user management. Enable creation and management of flocks. Implement daily data entry for feed, water, mortality, and egg production. Implement inventory items, reorder thresholds, and manual stock adjustment. Display essential metrics on a basic dashboard. |
| **Phase 2: Advanced Tracking & Reporting** | 4-5 Weeks | Integrate health and treatment logging. Add automatic inventory deduction, the transaction ledger, and weighted-average costing. Develop key performance reports (FCR, Broiler Growth Curve, Egg Production). Refine dashboard with more detailed metrics. |
| **Phase 3: Sales, Alerts & Polish** | 3-4 Weeks | Implement the sales module, including customer management and invoice generation. Develop the custom alert system with email notifications. Conduct comprehensive testing, bug fixing, and UI/UX polish. Prepare for initial launch. |

## MVP Feature List

Features are categorized by priority for delivery. References to `FR-XX` codes are from `PRD.md`.

> **FR numbers below follow [REQUIREMENTS.md](REQUIREMENTS.md).** They were reconciled on
> 2026-07-20 after diverging from `PRD.md`; earlier changelog entries may cite the old numbering.

### P0: Must Have (Launch MVP)

*   **User & System Administration:**
    *   User authentication via Supabase Auth (FR-10)
    *   Admin can invite and deactivate Farm Workers (FR-10)
    *   Admin can define/edit inventory items and reorder thresholds (FR-10)
*   **Flock Management:**
    *   Create/manage distinct flocks (Layer, Broiler) (FR-01)
    *   Optional individual bird tagging (FR-01)
*   **Daily Data Entry:**
    *   Streamlined form for daily logs — feed, water, mortality, eggs for Layer (FR-02)
    *   Weight sampling for Broiler flocks, with sample size (FR-03)
*   **Inventory Basics:** *(moved from P1 — see G-12)*
    *   Inventory item CRUD; reorder thresholds (FR-05)
    *   Manual stock adjustment (IN/OUT) (FR-05)
*   **Core Dashboard:**
    *   Today's egg production, mortality rate, low-stock warnings (FR-06)
*   **Audit Trail:** *(FR-13 — new, placed at P0)*
    *   Immutable record of every create, update, and delete, with actor and before/after diff
    *   **At P0 because it cannot be retrofitted.** Adding audit later leaves every change made
        before that point permanently unattributable — the history simply does not exist to backfill.

### P1: Should Have (Within 1 Month Post-Launch)

*   **Health & Treatment Logging:**
    *   Log health events with severity and open/resolved status (FR-04)
    *   Log treatments: medication from inventory, quantity used, dosage, route, withdrawal period (FR-04)
*   **Medication Withdrawal Enforcement:** *(FR-12 — new, placed at P1)*
    *   Compute and apply withdrawal clearance dates; block sale fulfilment; suppress sellable-egg
        posting; dashboard banner
    *   **Ships in the same release as FR-04, never later.** It cannot exist before treatments do,
        and treatments must not exist without it — recording a withdrawal period and ignoring it is
        worse than not recording it, because it looks like a control.
*   **Broiler Processing:** *(FR-11 — new, placed at P1)*
    *   Convert a completed broiler flock into sellable product stock; finalise FCR
    *   Timing is forced: the first broiler cycle ends ~45 days after launch, likely inside P1.
*   **Inventory Automation:** *(basics moved to P0 — see G-12)*
    *   Automatic deduction from daily logs and treatments (FR-05)
    *   Append-only transaction ledger with compensating reversals (FR-05)
    *   Weighted-average costing (`avgUnitCost`, `unitCostAtTime` snapshots) (FR-05)
*   **Advanced Dashboard Metrics:**
    *   FCR for both flocks; days until Broiler processing; water:feed ratio (FR-06)
*   **Key Reports:**
    *   Egg Production Report; Broiler Growth Curve Report (FR-07)
*   **Basic Alert System:**
    *   Production Alert (egg drop) and Mortality Alert (FR-08)

### P2: Post-Launch

*   **Full Sales Module:** *(G-60 resolved — **not** in the MVP)*
    *   Sales orders, customer database, fulfilment, PDF invoice generation (FR-09)
    *   **Rationale:** a farm can track production, health, and inventory without invoicing. Selling
        eggs on paper for a few weeks is survivable; losing a month of production data is not. The
        MVP protects the data that cannot be reconstructed later.
*   **Comprehensive Reporting:**
    *   Cost & Revenue Report (FR-07) — depends on FR-09 for the revenue side
*   **Full Alert System:**
    *   Inventory Alert (FR-08)
*   **UI/UX Enhancements:**
    *   Guided tour, improved responsiveness, advanced data visualizations.

## Milestones

| Milestone | Phase | Target Date | Deliverables |
|:---|:---|:---|:---|
| **Technical Foundation Ready** | 1 | Week 3 | Prisma schema validated and migrated. RLS lockdown applied and asserted in CI. Auth trigger live. Both security gates (`test:rls`, `test:secrets`) green. API for users and flocks. |
| **Core Data Entry Live** | 1 | Week 7 | FR-01, FR-02, FR-03, FR-10 complete. Inventory basics (FR-05) and core dashboard (FR-06). Audit trail (FR-13) recording from the first write. **This is the P0 / Launch MVP set.** |
| **Tracking & Basic Reports** | 2 | Week 11 | FR-04 (health + treatment) with FR-12 (withdrawal enforcement) in the same release. FR-11 (processing). Inventory automation and costing (FR-05). FCR and growth curve (FR-06, FR-07). |
| **Launch Candidate** | 3 | Week 14 | FR-08 (production + mortality alerts). All P0 and P1 complete. Six manual pre-launch checks passed — see the prerequisites table above. **FR-09 (Sales) is P2 and explicitly out of this milestone** *(G-60)*. |

## Dependencies

### External Dependencies

*   **Supabase Project:** Database, authentication, storage, and `pg_cron`. Needs the project URL,
    anon key, and service-role key (server-side only), plus both pooled and direct connection
    strings for Prisma.
*   **Vercel Account:** Frontend *and* API deployment, with CI/CD. No separate backend host.
*   **SendGrid Account:** Alert email only — **not** user invitations, which Supabase Auth sends.
*   **Domain Name:** For production deployment.
*   **Free-tier mitigations:** `.github/workflows/keepalive.yml` (prevents the 7-day pause) and
    `.github/workflows/backup.yml` (there are no automated backups on free). Both need repository
    secrets set: `HEALTHCHECK_URL` and `SUPABASE_DB_URL`.

### 🔴 Launch prerequisites — verified, not assumed

These are not tasks in a phase. Nothing goes live until every one is confirmed working.

| # | Prerequisite | Gap | Why |
|:---:|:---|:---|:---|
| 1 | **RLS enabled and forced on every `public` table** | G-65 | Until then the public anon key can read and write everything, bypassing all RBAC |
| 2 | **Custom SMTP configured in Supabase** | G-66 | Default mail sends 2/hour and refuses non-team addresses — invitations fail silently |
| 3 | **Production DB credentials scoped to Production only** | G-67 | Preview deployments otherwise write to real farm data |
| 4 | **A restore rehearsed into a scratch project** | G-68 | An untested backup is a claim, not a capability |
| 5 | Both workflow secrets set and one manual run green | G-59 | A scheduled job nobody has run is not a safeguard |
| 6 | No server secret carries a `NEXT_PUBLIC_` prefix | G-72 | The service-role key bypasses RLS entirely |

Items 1 and 2 are the ones that fail *silently* — the system looks correct while being wrong. Both
deserve an explicit test, not an assumption.
*   **Payment Gateway (Optional for Sales):** If online payments are to be integrated in the future (out of scope for MVP, but good to note).

### Internal Dependencies

*   **UI/UX Mockups & Wireframes:** For all key user flows and dashboard components.
*   **API Specifications:** Detailed OpenAPI/Swagger documentation for backend endpoints.
*   **Database Schema Design:** Finalized schema for PostgreSQL.
*   **Technical Design Documents:** For complex modules (e.g., FCR calculation logic, alert triggers).
*   **Test harness:** Vitest + local Supabase CLI in CI, with the RLS and secret-leak gates live from
    the first commit. See [TESTING.md](TESTING.md) — built **before** feature work, not alongside it.
*   **Content for Onboarding:** Text and images for first-time user guides.

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|:---|:---|:---|:---|
| **Scope Creep** | Delays delivery, increases cost, reduces focus on core features. | Medium | Strict adherence to PRD.md for MVP. Maintain a prioritized backlog for P1/P2 features. Regular stakeholder reviews to manage expectations. |
| **Technical Debt Accumulation** | Slows future development, increases maintenance burden. | Medium | Implement code reviews, adhere to coding standards, allocate time for refactoring in each sprint, use automated testing. |
| **Third-Party Service Outages** | System unavailability, loss of critical functionality (e.g., auth, notifications). | Low | Implement robust error handling and fallback mechanisms. Monitor service status pages. Consider redundancy for critical services if impact is high. |
| **Data Integrity Issues** | Flawed reports, incorrect decisions, loss of user trust. | Medium | Implement strong input validation (frontend & backend). Use database constraints. Regular data backups. User training on correct data entry. |
| **Developer Burnout/Attrition** | Significant delays, knowledge loss, impact on team morale. | Medium | Maintain realistic sprint goals. Encourage work-life balance. Cross-train team members. Document key architectural decisions and code. |
| **Performance Degradation** | Slow response times, poor user experience, especially with data-rich dashboards. | Medium | Regular performance testing. Optimize database queries. Implement caching strategies. Monitor application performance metrics. |