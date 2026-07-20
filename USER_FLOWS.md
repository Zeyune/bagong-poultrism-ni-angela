# USER_FLOWS.md: PoultryPilot

## 1. User Authentication & Authorization

### 1.1. User Login
*   **Actors:** Admin, Farm Worker
*   **Trigger:** User attempts to access the PoultryPilot system.
*   **Preconditions:** User has an active account.
*   **Main Flow:**
    1.  User navigates to the PoultryPilot web application.
    2.  System displays the login page (via Clerk).
    3.  User enters credentials (email/password or uses social login).
    4.  System authenticates user via Clerk.
    5.  System checks user's role (Admin or Farm Worker).
    6.  System redirects user to the appropriate dashboard based on role and successful authentication.
*   **Postconditions:** User is logged in and authorized to access system features based on their role.
*   **Alternative Flows:**
    *   **Invalid Credentials:** System displays an error message.
    *   **Account Locked/Inactive:** System displays an error message.

### 1.2. User Logout
*   **Actors:** Admin, Farm Worker
*   **Trigger:** User clicks "Logout".
*   **Preconditions:** User is logged in.
*   **Main Flow:**
    1.  User clicks the "Logout" button.
    2.  System invalidates the user's session (via Clerk).
    3.  System redirects user to the login page.
*   **Postconditions:** User is logged out.

## 2. Admin: Initial Farm & Flock Setup

### 2.1. Initial Farm Configuration
*   **Actors:** Admin
*   **Trigger:** First-time Admin login or accessing "Settings" -> "Farm Details".
*   **Preconditions:** Admin is logged in.
*   **Main Flow:**
    1.  Admin navigates to "Farm Settings".
    2.  System displays farm details form (e.g., Farm Name, Location).
    3.  Admin enters/updates farm information.
    4.  Admin saves changes.
    5.  System validates input and saves farm details.
    6.  System displays success message.
*   **Postconditions:** Farm details are configured.

### 2.2. Creating a New Flock
*   **Actors:** Admin
*   **Trigger:** Admin wants to add a new flock (e.g., initial 50 Layer, 50 Broiler).
*   **Preconditions:** Admin is logged in.
*   **Main Flow:**
    1.  Admin navigates to "Flock Management".
    2.  Admin clicks "Add New Flock".
    3.  System displays "Create Flock" form.
    4.  Admin enters flock details:
        *   Flock Name (e.g., "Layer Flock 1", "Broiler Flock A")
        *   Flock Type (e.g., "Layer", "Broiler")
        *   Number of Birds (e.g., 50)
        *   Start Date
        *   (Optional) Enable individual bird tagging.
    5.  Admin submits the form.
    6.  System validates input and creates the new flock.
    7.  System displays success message and adds the flock to the list.
*   **Postconditions:** A new flock is created and available for data entry.

## 3. Admin: Managing Inventory Items

### 3.1. Adding a New Inventory Item
*   **Actors:** Admin
*   **Trigger:** Admin needs to track a new item (e.g., new feed type, medication).
*   **Preconditions:** Admin is logged in.
*   **Main Flow:**
    1.  Admin navigates to "Inventory Management".
    2.  Admin clicks "Add New Item".
    3.  System displays "Add Inventory Item" form.
    4.  Admin enters item details:
        *   Item Name (e.g., "Layer Feed 16%", "Coccidiostat")
        *   Category (e.g., "Feed", "Medication", "Supplement")
        *   Unit of Measure (e.g., "kg", "L", "g", "ml")
        *   Initial Quantity
        *   Cost per Unit
        *   Reorder Threshold (for low inventory alerts).
    5.  Admin submits the form.
    6.  System validates input and creates the inventory item.
    7.  System displays success message and adds the item to the inventory list.
*   **Postconditions:** New inventory item is added and tracked.

### 3.2. Updating Inventory Quantity (Manual Adjustment)
*   **Actors:** Admin
*   **Trigger:** Admin needs to manually adjust inventory (e.g., new delivery, spoilage).
*   **Preconditions:** Admin is logged in, item exists in inventory.
*   **Main Flow:**
    1.  Admin navigates to "Inventory Management".
    2.  Admin selects an existing inventory item.
    3.  Admin clicks "Adjust Quantity".
    4.  System displays adjustment form.
    5.  Admin enters:
        *   Adjustment Type (e.g., "Add Stock", "Remove Stock")
        *   Quantity to adjust
        *   Reason for adjustment (optional).
    6.  Admin submits the form.
    7.  System updates the item's quantity.
    8.  System displays success message.
*   **Postconditions:** Inventory quantity is updated.

## 4. Admin: Configuring System Alerts

### 4.1. Setting/Editing Alert Thresholds
*   **Actors:** Admin
*   **Trigger:** Admin wants to customize alert sensitivity.
*   **Preconditions:** Admin is logged in.
*   **Main Flow:**
    1.  Admin navigates to "Settings" -> "Alerts Configuration".
    2.  System displays configurable alert types and their current thresholds:
        *   Egg Production Drop Threshold (%)
        *   Mortality Count Threshold (per 24h)
        *   Inventory Reorder Thresholds (per item - linked from inventory management).
    3.  Admin modifies desired threshold values.
    4.  Admin saves changes.
    5.  System validates input and updates alert settings.
    6.  System displays success message.
*   **Postconditions:** System alerts will trigger based on the new thresholds.

## 5. Admin: Managing User Accounts

### 5.1. Inviting a New Farm Worker
*   **Actors:** Admin
*   **Trigger:** Admin needs to add a new farm worker to the system.
*   **Preconditions:** Admin is logged in.
*   **Main Flow:**
    1.  Admin navigates to "User Management".
    2.  Admin clicks "Invite New User".
    3.  System displays "Invite User" form.
    4.  Admin enters the new user's email address.
    5.  Admin selects "Farm Worker" role.
    6.  Admin submits the form.
    7.  System (via Clerk) sends an invitation email to the specified address.
    8.  System displays success message and adds the pending user to the list.
*   **Postconditions:** An invitation is sent, and a new Farm Worker account is pending activation.

### 5.2. Deactivating/Deleting a User Account
*   **Actors:** Admin
*   **Trigger:** A farm worker leaves or no longer needs system access.
*   **Preconditions:** Admin is logged in, user account exists.
*   **Main Flow:**
    1.  Admin navigates to "User Management".
    2.  Admin selects the target user from the list.
    3.  Admin clicks "Deactivate" or "Delete".
    4.  System prompts for confirmation.
    5.  Admin confirms the action.
    6.  System (via Clerk) deactivates/deletes the user account.
    7.  System displays success message.
*   **Postconditions:** User account is deactivated/deleted, and they can no longer log in.

## 6. Daily Data Entry: Layer Flock

### 6.1. Logging Daily Layer Flock Data
*   **Actors:** Farm Worker, Admin
*   **Trigger:** End of day, or as required for daily logging.
*   **Preconditions:** User is logged in, Layer flock exists.
*   **Main Flow:**
    1.  User navigates to "Daily Logs" or clicks a quick-access button from the dashboard.
    2.  User selects the "Layer" flock.
    3.  System displays the daily log form for Layer flocks.
    4.  User inputs:
        *   Date (defaults to current day)
        *   Total Eggs Collected
        *   Cracked/Unsellable Eggs
        *   Feed Consumed (kg)
        *   Water Consumed (L)
        *   Mortality Count
    5.  User submits the log.
    6.  System validates input, saves the log entry, and automatically:
        *   Deducts feed consumed from inventory.
        *   Checks for production drop alerts (FR-07).
        *   Checks for mortality alerts (FR-07).
    7.  System displays success message.
*   **Postconditions:** Daily Layer flock data is recorded, inventory is updated, and alerts are triggered if thresholds are met.

## 7. Daily Data Entry: Broiler Flock

### 7.1. Logging Daily Broiler Flock Data
*   **Actors:** Farm Worker, Admin
*   **Trigger:** End of day, or as required for daily logging.
*   **Preconditions:** User is logged in, Broiler flock exists.
*   **Main Flow:**
    1.  User navigates to "Daily Logs" or clicks a quick-access button from the dashboard.
    2.  User selects the "Broiler" flock.
    3.  System displays the daily log form for Broiler flocks.
    4.  User inputs:
        *   Date (defaults to current day)
        *   Feed Consumed (kg)
        *   Water Consumed (L)
        *   Mortality Count
    5.  (Weekly) User inputs Average Bird Weight (g).
    6.  User submits the log.
    7.  System validates input, saves the log entry, and automatically:
        *   Deducts feed consumed from inventory.
        *   Checks for mortality alerts (FR-07).
    8.  System displays success message.
*   **Postconditions:** Daily Broiler flock data is recorded, inventory is updated, and alerts are triggered if thresholds are met.

## 8. Logging Health Events & Treatments

### 8.1. Recording a Health Event
*   **Actors:** Farm Worker, Admin
*   **Trigger:** Observation of a health issue in a flock or individual bird.
*   **Preconditions:** User is logged in.
*   **Main Flow:**
    1.  User navigates to "Health Logs".
    2.  User clicks "Log New Health Event".
    3.  System displays "Health Event" form.
    4.  User inputs:
        *   Date & Time of observation
        *   Affected Flock
        *   (Optional) Specific Bird ID (if individual tagging enabled)
        *   Symptoms/Observation (e.g., "Coccidiosis observed", "Limping")
        *   Severity (e.g., "Mild", "Moderate", "Severe")
        *   Notes.
    5.  User submits the form.
    6.  System validates input and saves the health event.
    7.  System displays success message.
*   **Postconditions:** Health event is recorded and visible in health logs and potentially on the dashboard as an active alert.

### 8.2. Recording a Treatment
*   **Actors:** Farm Worker, Admin
*   **Trigger:** Administration of medication or treatment.
*   **Preconditions:** User is logged in, health event may or may not be linked.
*   **Main Flow:**
    1.  User navigates to "Health Logs" or directly from a health event.
    2.  User clicks "Log New Treatment".
    3.  System displays "Treatment" form.
    4.  User inputs:
        *   Date & Time of treatment
        *   Affected Flock
        *   (Optional) Specific Bird ID
        *   Medication Name (selected from inventory)
        *   Dosage
        *   Route of Administration
        *   Withdrawal Period (days)
        *   Notes.
    5.  User submits the form.
    6.  System validates input, saves the treatment, and automatically:
        *   Deducts medication quantity from inventory.
    7.  System displays success message.
*   **Postconditions:** Treatment is recorded, medication inventory is updated.

## 9. Viewing Dashboard & Key Metrics

### 9.1. Accessing the Dashboard
*   **Actors:** Farm Worker, Admin
*   **Trigger:** Successful login or navigating to the "Dashboard" link.
*   **Preconditions:** User is logged in.
*   **Main Flow:**
    1.  User logs in or clicks "Dashboard".
    2.  System loads and displays the main dashboard.
    3.  System fetches and presents real-time metrics and widgets:
        *   Today's Egg Production vs. 7-Day Average
        *   Feed Conversion Ratio (FCR) for Layer and Broiler flocks.
        *   Mortality Rate (%) for both flocks.
        *   Days until Broiler processing countdown.
        *   Low Inventory warnings.
        *   Active health alerts.
    4.  User can interact with widgets (e.g., click for more detail).
*   **Postconditions:** User has an overview of current farm status and key performance indicators.

## 10. Generating Custom Reports

### 10.1. Generating an Egg Production Report
*   **Actors:** Admin, Farm Worker
*   **Trigger:** User needs to analyze egg production trends.
*   **Preconditions:** User is logged in, Layer flock data exists.
*   **Main Flow:**
    1.  User navigates to "Reports" -> "Egg Production Report".
    2.  System displays report configuration options.
    3.  User selects:
        *   Date Range (e.g., "Last 7 Days", "This Month", custom range)
        *   Flock (if multiple Layer flocks exist).
    4.  User clicks "Generate Report".
    5.  System processes data and displays a chart of daily/weekly/monthly egg production and hen-day percentage.
    6.  User can download the report (e.g., PDF, CSV).
*   **Postconditions:** User has an analytical view of egg production.

### 10.2. Generating a Broiler Growth Curve Report
*   **Actors:** Admin, Farm Worker
*   **Trigger:** User needs to monitor broiler growth against targets.
*   **Preconditions:** User is logged in, Broiler flock data (especially weekly weights) exists.
*   **Main Flow:**
    1.  User navigates to "Reports" -> "Broiler Growth Curve Report".
    2.  System displays report configuration options.
    3.  User selects:
        *   Broiler Flock
        *   Date Range (relevant to the flock's cycle).
    4.  User clicks "Generate Report".
    5.  System processes data and displays a chart plotting the flock's average weight over time against a pre-defined target growth curve.
    6.  User can download the report (e.g., PDF, CSV).
*   **Postconditions:** User has an analytical view of broiler growth performance.

### 10.3. Generating a Cost & Revenue Report
*   **Actors:** Admin
*   **Trigger:** Admin needs to review financial performance.
*   **Preconditions:** Admin is logged in, inventory usage and sales data exist.
*   **Main Flow:**
    1.  Admin navigates to "Reports" -> "Cost & Revenue Report".
    2.  System displays report configuration options.
    3.  Admin selects:
        *   Date Range.
    4.  Admin clicks "Generate Report".
    5.  System processes data and displays a summary of total costs (from inventory usage) and total revenue (from sales) over the selected period.
    6.  Admin can download the report (e.g., PDF, CSV).
*   **Postconditions:** Admin has an overview of the farm's financial performance.

## 11. Admin: Managing Sales Orders & Customers

### 11.1. Creating a New Sales Order
*   **Actors:** Admin
*   **Trigger:** A customer places an order for eggs or processed chicken.
*   **Preconditions:** Admin is logged in.
*   **Main Flow:**
    1.  Admin navigates to "Sales Management".
    2.  Admin clicks "Create New Order".
    3.  System displays "New Sales Order" form.
    4.  Admin selects an existing customer or adds a new customer (see 11.2).
    5.  Admin adds line items:
        *   Product (e.g., "Dozen Eggs", "Whole Processed Chicken")
        *   Quantity
        *   Unit Price (auto-populates, can be overridden).
    6.  System calculates subtotal and total.
    7.  Admin sets Order Status (e.g., "Pending", "Completed").
    8.  Admin submits the order.
    9.  System validates input, saves the sales order, and automatically:
        *   Deducts sold items from inventory (if applicable, e.g., processed chicken).
    10. System displays success message.
*   **Postconditions:** A new sales order is created, and inventory is updated.

### 11.2. Managing Customers
*   **Actors:** Admin
*   **Trigger:** Admin needs to add, edit, or view customer details.
*   **Preconditions:** Admin is logged in.
*   **Main Flow:**
    1.  Admin navigates to "Sales Management" -> "Customers".
    2.  System displays a list of existing customers.
    3.  **To Add Customer:**
        *   Admin clicks "Add New Customer".
        *   System displays "Add Customer" form.
        *   Admin enters Customer Name, Contact Info (phone, email), and Address.
        *   Admin submits the form.
        *   System saves customer details.
    4.  **To Edit Customer:**
        *   Admin selects a customer from the list and clicks "Edit".
        *   System displays "Edit Customer" form pre-filled with current data.
        *   Admin updates details and saves.
        *   System updates customer details.
    5.  System displays success message.
*   **Postconditions:** Customer database is updated.

### 11.3. Generating a PDF Invoice
*   **Actors:** Admin
*   **Trigger:** A sales order is completed, and an invoice is required.
*   **Preconditions:** Admin is logged in, a sales order exists and is marked "Completed".
*   **Main Flow:**
    1.  Admin navigates to "Sales Management" -> "Orders".
    2.  Admin selects a completed sales order.
    3.  Admin clicks "Generate Invoice (PDF)".
    4.  System generates a PDF document based on the order details (customer, items, quantities, prices, total).
    5.  System provides the PDF for download.
*   **Postconditions:** A PDF invoice for the sales order is generated and available.