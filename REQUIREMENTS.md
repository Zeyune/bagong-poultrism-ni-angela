# REQUIREMENTS.md: PoultryPilot

## 1. Functional Requirements

### 1.1. User-Facing Modules

#### FR-01: Flock Creation & Management
The system SHALL allow users to create and manage distinct flocks.
*   The system MUST support the creation of flocks with a specified type (e.g., "Layer", "Broiler").
*   The system SHALL support the initial setup of one "Layer" flock (50 birds) and one "Broiler" flock (50 birds).
*   The system SHOULD allow for optional individual bird tagging (e.g., `HEN-012`) within a flock for detailed tracking.
    *   **Acceptance Criteria:**
        *   A user can successfully create a new flock named "Layer Flock 1" of type "Layer" with an initial count of 50 birds.
        *   A user can successfully create a new flock named "Broiler Flock 1" of type "Broiler" with an initial count of 50 birds.
        *   A user can assign a unique identifier (e.g., "B-001") to an individual bird within "Broiler Flock 1" and view its details.

#### FR-02: Custom Daily Data Entry
The system SHALL provide a streamlined interface for daily data entry per flock.
*   The system MUST provide a dedicated form for daily log entry for each flock.
*   For "Layer" flocks, the form SHALL include fields for total eggs collected, cracked/unsellable eggs, feed consumed (kg), water consumed (L), and mortality count.
*   For "Broiler" flocks, the form SHALL include fields for feed consumed (kg), water consumed (L), mortality count, and a separate weekly input for average bird weight (g).
    *   **Acceptance Criteria:**
        *   A user can successfully submit a daily log for "Layer Flock 1" including 45 total eggs, 3 cracked eggs, 5.2 kg feed, 10.5 L water, and 0 mortality.
        *   A user can successfully submit a daily log for "Broiler Flock 1" including 6.8 kg feed, 12.1 L water, and 1 mortality.
        *   A user can successfully record the average weight for "Broiler Flock 1" as 1.8 kg for the current week.

#### FR-03: Health & Treatment Logging
The system SHALL enable users to log health events and treatments.
*   Users MUST be able to log health events (e.g., "Coccidiosis observed", "Respiratory distress") and associate them with a specific flock or an individual tagged bird.
*   Users SHALL be able to log treatments administered, including medication name, dosage, and withdrawal period.
    *   **Acceptance Criteria:**
        *   A user can log a health event "Limping" for "HEN-005" in "Layer Flock 1" with a timestamp.
        *   A user can log a treatment "Antibiotic X" for "Broiler Flock 1" with dosage "10ml/L", duration "5 days", and withdrawal period "7 days".
        *   The system displays a list of active health events and treatments for each flock.

#### FR-04: Inventory Management
The system SHALL track key farm inventory items.
*   The system MUST track quantities of feed types, medications, and supplements.
*   Daily feed consumption logs SHALL automatically deduct the corresponding quantity from the relevant feed inventory.
*   Treatment logs SHALL automatically deduct the used quantity from the relevant medication inventory.
    *   **Acceptance Criteria:**
        *   After a daily log reports 5kg of "Layer Feed" consumed, the "Layer Feed" inventory quantity decreases by 5kg.
        *   After logging a treatment using 100ml of "Antibiotic X", the "Antibiotic X" inventory quantity decreases by 100ml.
        *   A user can view the current stock level and consumption history for any inventory item.

#### FR-05: Data-Rich Dashboard
The system SHALL provide a centralized dashboard displaying critical farm metrics.
*   The dashboard MUST display real-time metrics including: Today's Egg Production vs. 7-Day Average, Feed Conversion Ratio (FCR) for both Layer and Broiler flocks, Mortality Rate (%) for both flocks, Days until Broiler processing (countdown from 45 days), Low Inventory warnings, and Active health alerts.
*   The dashboard SHOULD present these metrics in a modern and intuitive user interface.
    *   **Acceptance Criteria:**
        *   The dashboard correctly displays "Today's Eggs: 45 (7-Day Avg: 42)" for the Layer flock.
        *   The dashboard shows a countdown "Broiler Processing in: 30 days" for the Broiler flock.
        *   A "Low Inventory: Layer Feed" warning appears on the dashboard when the feed stock falls below its reorder threshold.

#### FR-06: Custom Reporting
The system SHALL generate various reports to provide insights into farm operations.
*   The system MUST generate an **Egg Production Report** charting daily/weekly/monthly egg production and hen-day percentage.
*   The system MUST generate a **Broiler Growth Curve Report** plotting the flock's average weight over time against a pre-defined target growth curve for the 45-day cycle.
*   The system MUST generate a **Cost & Revenue Report** summarizing total costs (derived from inventory usage) against total revenue (from sales) over a selected date range.
    *   **Acceptance Criteria:**
        *   A user can generate a weekly Egg Production Report for "Layer Flock 1" showing the hen-day percentage trend.
        *   A user can view a graph comparing the actual average weight of "Broiler Flock 1" against its target growth curve.
        *   A user can generate a Cost & Revenue Report for the previous month, detailing feed costs and egg sales revenue.

#### FR-07: Custom Alert System
The system SHALL notify users of critical events via email.
*   The system MUST send email notifications based on user-configurable triggers.
*   A **Production Alert** SHALL be triggered if egg production drops by more than 15% compared to the 7-day average.
*   A **Mortality Alert** SHALL be triggered if mortality in any flock exceeds 2 birds in a 24-hour period.
*   An **Inventory Alert** SHALL be triggered when any inventory item falls below its defined reorder threshold.
    *   **Acceptance Criteria:**
        *   An email notification is sent to the Admin when "Layer Flock 1" egg production drops from 45 to 30 eggs in a single day.
        *   An email notification is sent to the Admin if 3 birds are logged as deceased in "Broiler Flock 1" within a 24-hour window.
        *   An email notification is sent to the Admin when the "Broiler Feed" inventory quantity drops below 10 kg.

#### FR-08: Integrated Sales Module
The system SHALL support the creation and management of sales orders.
*   Users MUST be able to create sales orders for products (e.g., "Dozen Eggs", "Whole Processed Chicken").
*   The system SHALL maintain a simple customer database to track customer names, contact information, and order history.
*   The system SHALL generate and allow download of a simple PDF invoice from a completed sales order.
    *   **Acceptance Criteria:**
        *   A user can create a sales order for "3 Dozen Eggs" and "1 Whole Processed Chicken" for a new customer.
        *   A user can add a new customer with name "John Doe" and contact "john.doe@example.com" to the customer database.
        *   A user can download a PDF invoice for a completed sales order, showing items, quantities, and total amount.

### 1.2. Admin-Facing Modules

#### FR-09: User Management
The system SHALL allow the Admin to manage user accounts.
*   The Admin MUST be able to invite new users via email to the "Farm Worker" role.
*   The Admin MUST be able to deactivate or delete existing user accounts.
    *   **Acceptance Criteria:**
        *   The Admin can send an invitation email to `worker1@farm.com` to join as a "Farm Worker".
        *   The Admin can successfully deactivate the account of an existing "Farm Worker".
        *   The Admin can view a list of all active and inactive user accounts with their assigned roles.

#### FR-10: System Configuration
The system SHALL allow the Admin to configure key system parameters.
*   The Admin MUST be able to define and edit alert thresholds (e.g., mortality count, production drop percentage).
*   The Admin MUST be able to add/edit inventory items and set their low-stock reorder levels.
    *   **Acceptance Criteria:**
        *   The Admin can change the egg production drop alert threshold from 15% to 20%.
        *   The Admin can add a new inventory item "Vitamin Supplement" with a reorder level of 5 units.
        *   The Admin can modify the reorder level for "Broiler Feed" from 20kg to 15kg.

## 2. Non-Functional Requirements

| Category | Requirement | Measurable Target |
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

## 3. Technical Constraints

*   **Platform:** The system MUST be developed as a web-based application only; no native mobile application is planned for this phase.
*   **Technology Stack:** The system MUST adhere to the specified technology stack: React (Next.js) for frontend, Node.js (NestJS) for backend, PostgreSQL for the database, Clerk for authentication, and SendGrid for email notifications.
*   **Infrastructure:** Hosting for the frontend will be on Vercel, and for the backend/database on Render/Fly.io.
*   **Single Farm:** The system is constrained to support a single farm instance and does not include multi-tenancy capabilities in this initial version.
*   **Budget & Resources:** Development and operational costs are constrained by a small-scale project budget, necessitating efficient use of open-source and cost-effective cloud services.

## 4. Assumptions

*   **Internet Connectivity:** Users are assumed to have reliable internet access at the location where data entry and system usage occur.
*   **Data Accuracy:** The accuracy of the data and logs entered into the system is the responsibility of the user. The system will process and report based on the provided input.
*   **User Proficiency:** Users (Admin and Farm Worker) are assumed to have basic computer literacy to interact with a web-based application.
*   **Broiler Cycle:** The broiler chicken production cycle is assumed to be a fixed 45-day period for reporting and countdown purposes.
*   **Initial Scale:** The system's initial design and performance targets are based on managing a single farm with approximately 100 birds (50 layers, 50 broilers) across two flocks.