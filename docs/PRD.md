# PRD: PoultryPilot

## Executive Summary & Product Vision

This document outlines the product requirements for PoultryPilot, a specialized Farm Management System for small-scale poultry operations. The initial build targets a single farm with two distinct flocks: 50 layer hens for egg production and 50 broiler chickens for meat production (45-day cycle).

The product vision is to provide a data-rich, intuitive platform that empowers small farm owners to optimize flock health, maximize production yields, and streamline sales management through precise tracking and actionable insights.

## Problem Statement & Target Users

Small-scale poultry farmers lack accessible, modern tools to manage their operations effectively. They often rely on manual records (pen and paper, spreadsheets), which are prone to error, difficult to analyze, and offer no real-time insights. This leads to inefficiencies in feed management, delayed response to health issues, and lost revenue opportunities.

*   **Primary Target User:** Small-scale poultry farm owner/manager.
*   **Characteristics:** Manages 50-500 birds, is hands-on with daily operations, and seeks to improve profitability and efficiency through data-driven decisions.

## System Scope & User Roles

The system provides a centralized dashboard for flock management, health monitoring, production logging (eggs/meat), inventory control, and sales.

| Role | Description | Permissions |
|:---|:---|:---|
| **Admin** | The farm owner or primary manager. Has full system access. | Create/Edit/Delete all data. Manage users. Configure system settings & alerts. View all reports. |
| **Farm Worker** | A farm employee with limited data entry responsibilities. | Create daily logs (feed, water, mortality, eggs). Create health logs. View dashboard metrics. Cannot access financial data, user management, or system configuration. |

## Functional Requirements

> **Numbering is authoritative in [REQUIREMENTS.md](REQUIREMENTS.md)** and mirrored here. The two
> diverged briefly on 2026-07-20 when FR-03 (Weight Sampling) was introduced and shifted the
> sequence; this section is the reconciliation. Any future insertion appends a new highest number —
> **existing FR numbers are never reused or renumbered**, because they are referenced from
> `ROADMAP.md`, `TESTING.md`, test names, and commit messages.

**User-Facing Requirements**

*   **FR-01: Flock Creation & Management**
    *   System must support the creation of distinct flocks with specific types (e.g., "Layer", "Broiler").
    *   Initial setup will be for one "Layer" flock (50 birds) and one "Broiler" flock (50 birds).
    *   Allow optional individual bird tagging (e.g., `HEN-012`) for specific health or performance tracking, while defaulting to flock-level data aggregation.

*   **FR-02: Daily Data Entry**
    *   Provide a streamlined form for daily log entry per flock.
    *   For Layer flocks: total eggs collected, cracked/unsellable eggs, eggs discarded under withdrawal, feed consumed (kg), water consumed (L), and mortality count.
    *   For Broiler flocks: feed consumed (kg), water consumed (L), and mortality count.
    *   One log per flock per calendar day, in farm-local time. Backfilling permitted; editing reverses and re-posts inventory movements.

*   **FR-03: Weight Sampling**
    *   Record periodic (typically weekly) average bird weight for Broiler flocks, with the **sample size** — a 3-bird sample and a 50-bird sample are not equivalent evidence.
    *   Separate from the daily log, which is why it is its own requirement.

*   **FR-04: Health & Treatment Logging**
    *   Users can log health events (e.g., "Coccidiosis observed", "Respiratory distress") and associate them with a flock or a specific tagged bird, with a severity and an open/resolved status.
    *   Log treatments administered, selecting the medication from inventory and recording the quantity used, dosage, route, and withdrawal period.

*   **FR-05: Inventory Management**
    *   Track quantities of key inventory items: feed types, medications, supplements, and sellable products.
    *   Daily feed consumption logs automatically deduct from the corresponding feed inventory item.
    *   Treatment logs automatically deduct from medication inventory.
    *   Append-only transaction ledger with weighted-average costing.

*   **FR-06: Data-Rich Dashboard**
    *   The main dashboard will display critical, real-time metrics in a modern UI.
    *   Key widgets:
        *   Today's Egg Production vs. 7-Day Average
        *   Feed Conversion Ratio (FCR) for both Layer and Broiler flocks.
        *   Mortality Rate (%) for both flocks.
        *   Days until Broiler processing (countdown from 45 days).
        *   Low Inventory warnings.
        *   Active health alerts.

*   **FR-07: Custom Reporting**
    *   **Egg Production Report:** Chart daily/weekly/monthly egg production and hen-day percentage.
    *   **Broiler Growth Curve Report:** Plot the flock's average weight over time against a pre-defined target growth curve for the 45-day cycle.
    *   **Cost & Revenue Report:** Summarize total costs (from inventory usage) against total revenue (from sales) over a selected date range.

*   **FR-08: Custom Alert System**
    *   The system will send email notifications based on user-configurable triggers.
    *   **Production Alert:** Trigger if egg production drops >15% compared to the 7-day average.
    *   **Mortality Alert:** Trigger if mortality in any flock exceeds 2 birds in a 24-hour period.
    *   **Inventory Alert:** Trigger when any inventory item falls below its defined reorder threshold.

*   **FR-09: Integrated Sales Module**
    *   Users can create sales orders for products (e.g., "Dozen Eggs", "Whole Processed Chicken").
    *   A simple customer database to track customer names, contact info, and order history.
    *   Generate and download a simple PDF invoice from a completed sales order.

*   **FR-11: Broiler Processing**
    *   Record the end of a broiler cycle: date, birds processed, total live weight, dressed weight.
    *   Convert the flock's birds into sellable product inventory, closing out the cycle and
        finalising the flock's Feed Conversion Ratio.
    *   Limited to Broiler flocks, once per flock.

*   **FR-12: Medication Withdrawal Enforcement**
    *   Compute a withdrawal clearance date from each treatment and apply it to the flock.
    *   **Block fulfilment of any sale** of product sourced from a flock still under withdrawal.
    *   Prompt for discarded eggs during withdrawal and exclude them from sellable stock.
    *   Display an active withdrawal banner on the dashboard until the date clears.

*   **FR-13: Audit Trail**
    *   Record an immutable log of every create, update, and delete, with actor and a before/after
        diff.
    *   Readable by Admins only; never editable or deletable.

**Admin-Facing Requirements**

*   **FR-10: User & System Administration**
    *   Admin can invite new users by email to the "Farm Worker" role, via Supabase Auth.
    *   Admin can deactivate user accounts. Deactivation is a status change, never a delete — authored records must retain a valid author.
    *   Admin can define and edit alert thresholds (mortality count, production drop %), scoped per flock or farm-wide.
    *   Admin can add and edit inventory items and set their low-stock reorder levels.

## Non-Functional Requirements

| Category | Requirement | Target |
|:---|:---|:---|
| **Performance** | API Response Time (p95) | < 200ms |
| | Page Load Time (LCP) | < 2.5s |
| **Scalability** | Initial Design Capacity | 1 Farm, 5 Flocks, 1,000 Birds |
| | Concurrent Users | 5 |
| **Availability** | System Uptime | 99.5% |
| **Security** | Authentication & Authorization | RBAC enforced on all API routes. No unauthenticated access. |
| | Data Transmission | All traffic over HTTPS/TLS 1.2+. |
| **Usability** | Interface | Web-based, responsive design for desktop and mobile browsers. |
| | Onboarding | First-time user guided tour for key features. |

## Technology Stack & Rationale

| Component | Technology | Rationale |
|:---|:---|:---|
| **Frontend** | React (Next.js) | Fast, server-rendered pages; component architecture suits a data-rich dashboard; strong ecosystem. |
| **Backend** | Next.js Route Handlers | Runs on the same Vercel deployment as the frontend — one deployable, one bill, shared TypeScript types. Replaces the originally specified NestJS, which expects a long-running server and fits Vercel's serverless model poorly. |
| **Database** | PostgreSQL via Supabase | Managed Postgres with connection pooling, `pg_cron` for scheduled jobs, and Storage for invoice PDFs. Free tier is genuinely usable at this scale. |
| **Hosting** | Vercel + Supabase | Serverless functions cold-start in ~100–300ms rather than the ~1 minute of spin-down container tiers, so a once-daily usage pattern stays responsive. No separate backend host. |
| **Authentication** | Supabase Auth | Same platform as the database, so user provisioning is a Postgres trigger rather than a webhook — no signature verification, no delivery lag, no partially-provisioned state. Replaces the originally specified Clerk. |
| **Scheduled jobs** | `pg_cron` (Supabase) | Runs the low-inventory sweep and nightly stock reconciliation. The original stack had no scheduler at all. |
| **Notifications** | SendGrid | Email delivery for farm alerts only — **not** for user invitations, which Supabase Auth sends. |

## Success Metrics & KPIs

| Metric | Description | Target |
|:---|:---|:---|
| **User Engagement** | Daily Active Users (DAU) | 1+ (The primary user logs in daily) |
| **Task Completion Rate** | % of days a daily log is successfully submitted | > 95% |
| **Data Utilization** | # of reports generated per week | > 2 |
| **User Satisfaction** | Net Promoter Score (NPS) via in-app survey | > 40 |

## Risk Analysis & Mitigation

| Risk | Description | Impact | Mitigation Strategy |
|:---|:---|:---|:---|
| **Poor Data Integrity** | Incorrect data entry leads to flawed reports and bad decisions. | High | Implement strict input validation, use clear UI labels, provide tooltips, and default to sensible values where possible. |
| **Low User Adoption** | The system is perceived as too complex or time-consuming. | High | Prioritize UX/UI simplicity. Create a <5 minute onboarding flow. Ensure the mobile web experience is excellent for quick data entry in the field. |
| **Scope Creep** | Adding un-planned features delays the core product launch. | Medium | Adhere strictly to this PRD for v1. Maintain a prioritized backlog for future features and get user validation before committing. |
| **Vendor Lock-in** | Heavy reliance on Supabase for database, auth, scheduling, and storage. | Medium | Raised from Low: consolidating on one vendor is what makes this stack cheap and simple, and also what makes leaving expensive. Keep business logic in application code rather than database functions where practical, use Prisma (portable to any Postgres), and confine Supabase-specific calls behind an `AuthService` interface. The database itself is standard Postgres and can be dumped and moved. |
| **Free-tier limits** | Project pauses after 7 days idle; no automated backups. | Medium | Explicit decision to run on the free tier. Mitigate with a scheduled keep-alive ping and a scheduled `pg_dump` to versioned storage. Revisit before the farm depends on this as its record of truth. |

## Constraints & Assumptions

*   The system is designed for a single farm and does not support multi-tenancy in its initial version.
*   The user is assumed to have reliable internet access at the location where data entry occurs.
*   The system will be web-based only. No native mobile application will be developed in this phase.
*   The user is responsible for the accuracy of the data entered.

## Out of Scope

The following features will NOT be included in the initial release:

*   Multi-farm or multi-tenancy support.
*   Advanced financial accounting (e.g., asset depreciation, payroll, tax calculation).
*   Direct integration with IoT hardware (e.g., automated sensors for temperature, feed levels).
*   Offline data entry mode.
*   Breeding program management and genetic lineage tracking.
*   Direct E-commerce storefront for end customers.