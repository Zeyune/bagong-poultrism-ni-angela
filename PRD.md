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

**User-Facing Requirements**

*   **FR-01: Flock Creation & Management**
    *   System must support the creation of distinct flocks with specific types (e.g., "Layer", "Broiler").
    *   Initial setup will be for one "Layer" flock (50 birds) and one "Broiler" flock (50 birds).
    *   Allow optional individual bird tagging (e.g., `HEN-012`) for specific health or performance tracking, while defaulting to flock-level data aggregation.

*   **FR-02: Custom Daily Data Entry**
    *   Provide a streamlined form for daily log entry per flock.
    *   For Layer flocks: input for total eggs collected, cracked/unsellable eggs, feed consumed (kg), water consumed (L), and mortality count.
    *   For Broiler flocks: input for feed consumed (kg), water consumed (L), mortality count, and a separate weekly input for average bird weight (g).

*   **FR-03: Health & Treatment Logging**
    *   Users can log health events (e.g., "Coccidiosis observed", "Respiratory distress") and associate them with a flock or a specific tagged bird.
    *   Log treatments administered, including medication name, dosage, and withdrawal period.

*   **FR-04: Inventory Management**
    *   Track quantities of key inventory items: feed types, medications, supplements.
    *   Daily feed consumption logs will automatically deduct from the corresponding feed inventory.
    *   Treatment logs will automatically deduct from medication inventory.

*   **FR-05: Data-Rich Dashboard**
    *   The main dashboard will display critical, real-time metrics in a modern UI.
    *   Key widgets:
        *   Today's Egg Production vs. 7-Day Average
        *   Feed Conversion Ratio (FCR) for both Layer and Broiler flocks.
        *   Mortality Rate (%) for both flocks.
        *   Days until Broiler processing (countdown from 45 days).
        *   Low Inventory warnings.
        *   Active health alerts.

*   **FR-06: Custom Reporting**
    *   **Egg Production Report:** Chart daily/weekly/monthly egg production and hen-day percentage.
    *   **Broiler Growth Curve Report:** Plot the flock's average weight over time against a pre-defined target growth curve for the 45-day cycle.
    *   **Cost & Revenue Report:** Summarize total costs (from inventory usage) against total revenue (from sales) over a selected date range.

*   **FR-07: Custom Alert System**
    *   The system will send email notifications based on user-configurable triggers.
    *   **Production Alert:** Trigger if egg production drops >15% compared to the 7-day average.
    *   **Mortality Alert:** Trigger if mortality in any flock exceeds 2 birds in a 24-hour period.
    *   **Inventory Alert:** Trigger when any inventory item falls below its defined reorder threshold.

*   **FR-08: Integrated Sales Module**
    *   Users can create sales orders for products (e.g., "Dozen Eggs", "Whole Processed Chicken").
    *   A simple customer database to track customer names, contact info, and order history.
    *   Generate and download a simple PDF invoice from a completed sales order.

**Admin-Facing Requirements**

*   **FR-09: User Management**
    *   Admin can invite new users via email to the "Farm Worker" role.
    *   Admin can deactivate or delete user accounts.

*   **FR-10: System Configuration**
    *   Admin can define and edit alert thresholds (e.g., mortality count, production drop %).
    *   Admin can add/edit inventory items and set their low-stock reorder levels.

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
| **Frontend** | React (Next.js) | Enables fast, server-rendered pages for a responsive feel. Component-based architecture is ideal for a data-rich dashboard. Strong ecosystem. |
| **Backend** | Node.js (NestJS) | Provides a structured, scalable, and maintainable backend architecture. TypeScript ensures type safety and aligns with the frontend stack. |
| **Database** | PostgreSQL | A robust, open-source relational database perfect for structured farm data, financial records, and ensuring data integrity. |
| **Hosting** | Vercel & Render/Fly.io | Vercel offers seamless CI/CD for Next.js. Render/Fly.io provides cost-effective, scalable hosting for the backend and database with easy deployment. |
| **Authentication** | Clerk | Offloads complex user management, authentication, and security, accelerating development and ensuring best practices are followed. |
| **Notifications** | SendGrid | A reliable and scalable email API for delivering critical system alerts to users. |

## Success Metrics & KPIs

| Metric | Description | Target |
|:---|:---|:---|
| **User Engagement** | Daily Active Users (DAU) | 1+ (The primary user logs in daily) |
| **Task Completion Rate** | % of days a daily log is successfully submitted | > 95% |
| **Data Utilization** | # of reports generated per week | > 2 |
| **User Satisfaction** | Net Promoter Score (NPS) via in-app survey | > 40 |

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation Strategy |
|:---|:---|:---|
| **Poor Data Integrity** | Incorrect data entry leads to flawed reports and bad decisions. | High | Implement strict input validation, use clear UI labels, provide tooltips, and default to sensible values where possible. |
| **Low User Adoption** | The system is perceived as too complex or time-consuming. | High | Prioritize UX/UI simplicity. Create a <5 minute onboarding flow. Ensure the mobile web experience is excellent for quick data entry in the field. |
| **Scope Creep** | Adding un-planned features delays the core product launch. | Medium | Adhere strictly to this PRD for v1. Maintain a prioritized backlog for future features and get user validation before committing. |
| **Vendor Lock-in** | Over-reliance on third-party services like Clerk or SendGrid. | Low | Use abstraction layers (e.g., an `AuthService` interface) in the codebase to decouple from the specific vendor API, simplifying future replacement if necessary. |

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