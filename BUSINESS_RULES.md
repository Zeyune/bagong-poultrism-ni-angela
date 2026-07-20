# BUSINESS_RULES.md: PoultryPilot

## 1. Core Business Rules

These rules define the fundamental operations and logic governing the PoultryPilot system.

*   **BR-01: Farm Scope:** The system is designed to manage a single poultry farm. Multi-farm management is out of scope for this version.
*   **BR-02: Flock Types:** The system supports two primary flock types: "Layer" (for egg production) and "Broiler" (for meat production).
*   **BR-03: Initial Flock Configuration:** The system will initially manage one "Layer" flock of 50 birds and one "Broiler" flock of 50 birds.
*   **BR-04: Broiler Cycle Duration:** Broiler flocks are managed on a 45-day production cycle, after which they are typically processed.
*   **BR-05: Bird Tracking Granularity:** Data entry defaults to flock-level aggregation. Individual bird tracking (e.g., `HEN-012`) is optional and can be enabled for specific health or performance monitoring.
*   **BR-06: Daily Log Requirements - Layer Flocks:** Daily logs for Layer flocks must include total eggs collected, cracked/unsellable eggs, feed consumed (kg), water consumed (L), and mortality count.
*   **BR-07: Daily Log Requirements - Broiler Flocks:** Daily logs for Broiler flocks must include feed consumed (kg), water consumed (L), and mortality count. Weekly input for average bird weight (g) is also required.
*   **BR-08: Inventory Deduction - Feed:** Daily feed consumption logs automatically deduct the specified quantity from the corresponding feed inventory item.
*   **BR-09: Inventory Deduction - Medication:** Treatment logs automatically deduct the specified dosage/quantity from the corresponding medication inventory item.
*   **BR-10: Production Alert Trigger:** An email notification is triggered if egg production for a Layer flock drops by more than 15% compared to its 7-day average. The threshold is configurable by an Admin.
*   **BR-11: Mortality Alert Trigger:** An email notification is triggered if mortality in any flock exceeds 2 birds within a 24-hour period. The threshold is configurable by an Admin.
*   **BR-12: Low Inventory Alert Trigger:** An email notification is triggered when the quantity of any inventory item falls below its predefined reorder threshold. The threshold is configurable by an Admin.
*   **BR-13: Sales Order Creation:** Sales orders can be created for defined products (e.g., "Dozen Eggs", "Whole Processed Chicken") and linked to customer records.
*   **BR-14: Invoice Generation:** Upon completion of a sales order, a simple PDF invoice can be generated and downloaded.
*   **BR-15: Cost Calculation:** Total costs are aggregated based on the unit cost of inventory items (feed, medications, supplements) consumed by flocks over a selected period.
*   **BR-16: Revenue Calculation:** Total revenue is aggregated from completed sales orders over a selected period.

## 2. Domain Constraints & Validation Rules

These rules ensure data integrity and consistency within the system.

*   **Flock Management:**
    *   `Flock Name`: Must be unique within the farm.
    *   `Flock Type`: Must be either "Layer" or "Broiler".
    *   `Initial Bird Count`: Must be a positive integer.
    *   `Current Bird Count`: Must be a non-negative integer, less than or equal to the initial bird count.
*   **Daily Logs:**
    *   `Date`: Must be a valid date, not in the future.
    *   `Eggs Collected (Total, Cracked)`: Must be non-negative integers. Cracked eggs cannot exceed total eggs.
    *   `Feed Consumed (kg)`: Must be a non-negative decimal value.
    *   `Water Consumed (L)`: Must be a non-negative decimal value.
    *   `Mortality Count`: Must be a non-negative integer, less than or equal to the current flock size.
    *   `Average Bird Weight (g)` (Broiler only): Must be a positive decimal value.
*   **Health & Treatment Logs:**
    *   `Event Date`: Must be a valid date, not in the future.
    *   `Medication Name`: Must be selected from a predefined inventory list.
    *   `Dosage`: Must be a positive decimal value.
    *   `Withdrawal Period (days)`: Must be a non-negative integer.
*   **Inventory Management:**
    *   `Item Name`: Must be unique.
    *   `Current Quantity`: Must be a non-negative decimal value.
    *   `Unit Cost`: Must be a non-negative decimal value.
    *   `Reorder Threshold`: Must be a non-negative decimal value, less than or equal to the maximum expected quantity.
*   **Sales Orders:**
    *   `Order Date`: Must be a valid date, not in the future.
    *   `Product Quantity`: Must be a positive integer.
    *   `Unit Price`: Must be a positive decimal value.
    *   `Customer Name`: Cannot be empty.
*   **Alert Configuration:**
    *   `Production Drop Threshold`: Must be a percentage between 0 and 100.
    *   `Mortality Count Threshold`: Must be a positive integer.
    *   `Reorder Threshold`: Must be a non-negative decimal value.

## 3. Status Transitions Table

This table outlines the possible state changes for key entities within the system.

| Current State | Event/Action | New State | Notes/Side Effects |
|:---|:---|:---|:---|
| **Flock** | | | |
| Active | Broiler cycle ends (45 days) | Processed | Triggers final weight entry, removes flock from active management. |
| Active | Admin deactivates flock | Inactive | Flock data becomes read-only, no further daily logs. |
| Inactive | Admin reactivates flock | Active | Allows resumption of daily logs. |
| **Health Event** | | | |
| Open | Admin marks as resolved | Resolved | Indicates the health issue has been addressed. |
| **Sales Order** | | | |
| Draft | User saves order | Placed | Order is confirmed and awaiting fulfillment. |
| Placed | User marks as fulfilled | Fulfilled | Inventory is deducted, revenue is recorded. Invoice can be generated. |
| Placed | User cancels order | Cancelled | Order is voided, no inventory deduction or revenue recorded. |

## 4. Pricing Logic

*   **Product Pricing:**
    *   Each sellable product (e.g., "Dozen Eggs", "Whole Processed Chicken") has a user-defined `Unit Price`. This price is set by the Admin and can be updated.
    *   Sales order line items calculate `Total Price = Product Quantity * Unit Price`.
*   **Cost Calculation:**
    *   Inventory items (feed, medication, supplements) have a user-defined `Unit Cost`.
    *   `Total Cost of Consumption` for a period is calculated by summing (`Quantity Consumed * Unit Cost`) for all inventory items deducted during that period.
*   **Profit/Loss Calculation:**
    *   `Gross Profit/Loss` for a period is calculated as `Total Revenue (from sales) - Total Cost of Consumption`.

## 5. Role Access Policies

Access to system functionalities is governed by the assigned user role.

| Role | Permitted Actions | Restricted Actions |
|:---|:---|:---|
| **Admin** | Create/Edit/Delete all data (Flocks, Logs, Inventory, Sales, Customers). Manage users (invite, deactivate, delete). Configure system settings (alerts, thresholds). View all reports. | None |
| **Farm Worker** | Create daily logs (feed, water, mortality, eggs, weight). Create health logs. View dashboard metrics. View own created sales orders. | Access financial data (cost/revenue reports). Manage users. Configure system settings. Delete existing data (can only edit/create). |