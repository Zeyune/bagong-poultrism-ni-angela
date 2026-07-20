# API.md: PoultryPilot

## Authentication & Authorization

Authentication is handled via JSON Web Tokens (JWTs) issued by Clerk. After a user successfully authenticates through Clerk's frontend components, a JWT is provided. This token must be included in the `Authorization` header of all subsequent API requests.

*   **Method:** JWT (issued by Clerk)
*   **Header Format:** `Authorization: Bearer <your_jwt_token>`
*   **Roles:**
    *   **Admin:** Full access to all API endpoints, including user management and system configuration.
    *   **Farm Worker:** Limited access, primarily for data entry (daily logs, health logs) and viewing relevant dashboards. Cannot manage users, configure system settings, or access financial reports.

The backend validates the JWT, extracts the user ID and associated roles, and enforces role-based access control (RBAC) for each endpoint.

## Standard Response & Pagination Formats

All API responses adhere to a consistent structure for predictability and ease of consumption.

### Success Response

```json
{
  "success": true,
  "data": {
    // Primary response data (object or array)
  },
  "message": "Optional success message"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_ENUM", // e.g., "VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED"
    "message": "A human-readable description of the error."
  }
}
```

### Paginated List Response

For endpoints returning collections of resources, pagination metadata is included.

```json
{
  "success": true,
  "data": [
    { /* item 1 */ },
    { /* item 2 */ }
    // ... more items
  ],
  "pagination": {
    "totalItems": 100,
    "totalPages": 10,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

## API Endpoints

### 1. User Management

| Method | Path | Description | Auth Level | Request Body (JSON) | Response Body (JSON) | Status Codes |
|:---|:---|:---|:---|:---|:---|:---|
| `GET` | `/api/users/me` | Get details of the currently authenticated user. | Authenticated | `N/A` | `{ "success": true, "data": { "id": "user_abc", "email": "user@example.com", "role": "Admin" } }` | `200` |
| `POST` | `/api/users` | Invite a new user to the system (Farm Worker role). An email invitation is sent via SendGrid. | Admin | `{ "email": "new.worker@example.com", "firstName": "John", "lastName": "Doe" }` | `{ "success": true, "data": { "id": "user_xyz", "email": "new.worker@example.com" }, "message": "Invitation sent." }` | `201` |
| `GET` | `/api/users` | List all users registered in the system. | Admin | `N/A` | `{ "success": true, "data": [ { "id": "user_abc", "email": "admin@example.com", "role": "Admin" } ], "pagination": { ... } }` | `200` |
| `GET` | `/api/users/:id` | Get details for a specific user. | Admin | `N/A` | `{ "success": true, "data": { "id": "user_xyz", "email": "worker@example.com", "role": "Farm Worker" } }` | `200`, `404` |
| `PUT` | `/api/users/:id` | Update a user's details or role. | Admin | `{ "role": "Farm Worker", "isActive": true }` | `{ "success": true, "data": { "id": "user_xyz", "role": "Farm Worker" } }` | `200`, `400`, `404` |
| `DELETE` | `/api/users/:id` | Deactivate a user account. | Admin | `N/A` | `{ "success": true, "message": "User deactivated." }` | `200`, `404` |

### 2. Flock Management

| Method | Path | Description | Auth Level | Request Body (JSON) | Response Body (JSON) | Status Codes |
|:---|:---|:---|:---|:---|:---|:---|
| `POST` | `/api/flocks` | Create a new flock (Layer or Broiler). | Admin | `{ "name": "Layer Flock 1", "type": "Layer", "initialBirdCount": 50, "startDate": "2023-01-01" }` | `{ "success": true, "data": { "id": "flock_l1", "name": "Layer Flock 1" } }` | `201`, `400` |
| `GET` | `/api/flocks` | List all flocks. | Authenticated | `N/A` | `{ "success": true, "data": [ { "id": "flock_l1", "name": "Layer Flock 1", "type": "Layer" } ] }` | `200` |
| `GET` | `/api/flocks/:id` | Get details for a specific flock. | Authenticated | `N/A` | `{ "success": true, "data": { "id": "flock_l1", "name": "Layer Flock 1", "type": "Layer", "currentBirdCount": 48 } }` | `200`, `404` |
| `PUT` | `/api/flocks/:id` | Update flock details. | Admin | `{ "name": "Layer Flock A", "currentBirdCount": 49 }` | `{ "success": true, "data": { "id": "flock_l1", "name": "Layer Flock A" } }` | `200`, `400`, `404` |
| `DELETE` | `/api/flocks/:id` | Archive or delete a flock. | Admin | `N/A` | `{ "success": true, "message": "Flock archived." }` | `200`, `404` |
| `POST` | `/api/flocks/:id/birds` | Add individual birds to a flock (optional, for tagged birds). | Admin | `{ "tagId": "HEN-012", "hatchDate": "2022-10-15" }` | `{ "success": true, "data": { "id": "bird_012", "tagId": "HEN-012" } }` | `201`, `400`, `404` |
| `GET` | `/api/flocks/:id/birds` | List individual birds within a flock. | Authenticated | `N/A` | `{ "success": true, "data": [ { "id": "bird_012", "tagId": "HEN-012" } ] }` | `200`, `404` |
| `GET` | `/api/birds/:id` | Get details for a specific bird. | Authenticated | `N/A` | `{ "success": true, "data": { "id": "bird_012", "tagId": "HEN-012", "flockId": "flock_l1" } }` | `200`, `404` |
| `PUT` | `/api/birds/:id` | Update individual bird details. | Admin | `{ "status": "Healthy", "notes": "Leg band replaced." }` | `{ "success": true, "data": { "id": "bird_012", "status": "Healthy" } }` | `200`, `400`, `404` |

### 3. Daily Logs

| Method | Path | Description | Auth Level | Request Body (JSON) | Response Body (JSON) | Status Codes |
|:---|:---|:---|:---|:---|:---|:---|
| `POST` | `/api/flocks/:id/daily-logs` | Create a daily log entry for a flock. Automatically deducts inventory. | Farm Worker, Admin | `{ "logDate": "2023-10-26", "feedConsumedKg": 5.2, "waterConsumedL": 10.5, "mortalityCount": 1, "eggsCollected": 45, "crackedEggs": 2, "averageWeightG": null }` (Layer example) `{ "logDate": "2023-10-26", "feedConsumedKg": 6.0, "waterConsumedL": 12.0, "mortalityCount": 0, "eggsCollected": null, "crackedEggs": null, "averageWeightG": 1200 }` (Broiler example, `averageWeightG` is weekly) | `{ "success": true, "data": { "id": "log_001", "flockId": "flock_l1", "logDate": "2023-10-26" } }` | `201`, `400`, `404` |
| `GET` | `/api/flocks/:id/daily-logs` | List daily logs for a specific flock. | Authenticated | `N/A` | `{ "success": true, "data": [ { "id": "log_001", "logDate": "2023-10-26", "feedConsumedKg": 5.2 } ], "pagination": { ... } }` | `200`, `404` |
| `GET` | `/api/daily-logs/:id` | Get details for a specific daily log entry. | Authenticated | `N/A` | `{ "success": true, "data": { "id": "log_001", "flockId": "flock_l1", "logDate": "2023-10-26", "feedConsumedKg": 5.2 } }` | `200`, `404` |
| `PUT` | `/api/daily-logs/:id` | Update a specific daily log entry. | Farm Worker, Admin | `{ "feedConsumedKg": 5.5, "mortalityCount": 0 }` | `{ "success": true, "data": { "id": "log_001", "feedConsumedKg": 5.5 } }` | `200`, `400`, `404` |

### 4. Health & Treatment Logging

| Method | Path | Description | Auth Level | Request Body (JSON) | Response Body (JSON) | Status Codes |
|:---|:---|:---|:---|:---|:---|:---|
| `POST` | `/api/health-logs` | Create a new health event or treatment log. Automatically deducts medication inventory. | Farm Worker, Admin | `{ "flockId": "flock_l1", "birdId": null, "eventType": "Illness", "description": "Coccidiosis observed in 3 birds.", "treatment": "Amprolium", "dosage": "10ml/gal", "withdrawalPeriodDays": 5, "logDate": "2023-10-25" }` | `{ "success": true, "data": { "id": "health_001", "eventType": "Illness" } }` | `201`, `400`, `404` |
| `GET` | `/api/health-logs` | List all health and treatment logs. | Authenticated | `N/A` | `{ "success": true, "data": [ { "id": "health_001", "eventType": "Illness" } ], "pagination": { ... } }` | `200` |
| `GET` | `/api/health-logs/:id` | Get details for a specific health log. | Authenticated | `N/A` | `{ "success": true, "data": { "id": "health_001", "flockId": "flock_l1", "eventType": "Illness" } }` | `200`, `404` |
| `PUT` | `/api/health-logs/:id` | Update a specific health log entry. | Farm Worker, Admin | `{ "description": "Coccidiosis confirmed, treatment started." }` | `{ "success": true, "data": { "id": "health_001", "description": "Coccidiosis confirmed." } }` | `200`, `400`, `404` |

### 5. Inventory Management

| Method | Path | Description | Auth Level | Request Body (JSON) | Response Body (JSON) | Status Codes |
|:---|:---|:---|:---|:---|:---|:---|
| `POST` | `/api/inventory` | Add a new inventory item (e.g., feed type, medication). | Admin | `{ "name": "Layer Feed 16%", "unit": "kg", "currentQuantity": 500, "reorderThreshold": 100 }` | `{ "success": true, "data": { "id": "inv_f1", "name": "Layer Feed 16%" } }` | `201`, `400` |
| `GET` | `/api/inventory` | List all inventory items. | Authenticated | `N/A` | `{ "success": true, "data": [ { "id": "inv_f1", "name": "Layer Feed 16%", "currentQuantity": 490 } ] }` | `200` |
| `GET` | `/api/inventory/:id` | Get details for a specific inventory item. | Authenticated | `N/A` | `{ "success": true, "data": { "id": "inv_f1", "name": "Layer Feed 16%", "currentQuantity": 490, "reorderThreshold": 100 } }` | `200`, `404` |
| `PUT` | `/api/inventory/:id` | Update inventory item details (e.g., name, reorder threshold). | Admin | `{ "reorderThreshold": 150 }` | `{ "success": true, "data": { "id": "inv_f1", "reorderThreshold": 150 } }` | `200`, `400`, `404` |
| `POST` | `/api/inventory/:id/transactions` | Manually adjust inventory quantity (e.g., new stock arrival, manual correction). | Farm Worker, Admin | `{ "type": "addition", "quantity": 250, "notes": "New delivery from supplier." }` | `{ "success": true, "data": { "id": "inv_f1", "currentQuantity": 740 } }` | `201`, `400`, `404` |

### 6. Sales Management

| Method | Path | Description | Auth Level | Request Body (JSON) | Response Body (JSON) | Status Codes |
|:---|:---|:---|:---|:---|:---|:---|
| `POST` | `/api/customers` | Create a new customer record. | Admin | `{ "name": "Alice Smith", "email": "alice@example.com", "phone": "555-1234" }` | `{ "success": true, "data": { "id": "cust_001", "name": "Alice Smith" } }` | `201`, `400` |
| `GET` | `/api/customers` | List all customers. | Admin | `N/A` | `{ "success": true, "data": [ { "id": "cust_001", "name": "Alice Smith" } ] }` | `200` |
| `GET` | `/api/customers/:id` | Get details for a specific customer. | Admin | `N/A` | `{ "success": true, "data": { "id": "cust_001", "name": "Alice Smith", "email": "alice@example.com" } }` | `200`, `404` |
| `PUT` | `/api/customers/:id` | Update customer details. | Admin | `{ "phone": "555-5678" }` | `{ "success": true, "data": { "id": "cust_001", "phone": "555-5678" } }` | `200`, `400`, `404` |
| `POST` | `/api/sales-orders` | Create a new sales order. | Admin | `{ "customerId": "cust_001", "orderDate": "2023-10-26", "items": [ { "product": "Dozen Eggs", "quantity": 2, "unitPrice": 4.50 }, { "product": "Whole Processed Chicken", "quantity": 1, "unitPrice": 20.00 } ], "status": "Pending" }` | `{ "success": true, "data": { "id": "order_001", "customerId": "cust_001" } }` | `201`, `400`, `404` |
| `GET` | `/api/sales-orders` | List all sales orders. | Admin | `N/A` | `{ "success": true, "data": [ { "id": "order_001", "customerId": "cust_001", "totalAmount": 29.00 } ] }` | `200` |
| `GET` | `/api/sales-orders/:id` | Get details for a specific sales order. | Admin | `N/A` | `{ "success": true, "data": { "id": "order_001", "customerId": "cust_001", "items": [ { "product": "Dozen Eggs", "quantity": 2 } ] } }` | `200`, `404` |
| `PUT` | `/api/sales-orders/:id` | Update sales order status or details. | Admin | `{ "status": "Completed" }` | `{ "success": true, "data": { "id": "order_001", "status": "Completed" } }` | `200`, `400`, `404` |
| `GET` | `/api/sales-orders/:id/invoice` | Generate and download a PDF invoice for a sales order. | Admin | `N/A` | `(Binary PDF file)` | `200`, `404` |

### 7. Reporting & Dashboard Metrics

| Method | Path | Description | Auth Level | Request Body (JSON) | Response Body (JSON) | Status Codes |
|:---|:---|:---|:---|:---|:---|:---|
| `GET` | `/api/dashboard/metrics` | Get key dashboard metrics for the current day/week. | Authenticated | `N/A` | `{ "success": true, "data": { "todayEggs": 45, "sevenDayAvgEggs": 42, "broilerFCR": 1.8, "layerFCR": 2.2, "mortalityRate": 0.5, "daysToBroilerProcessing": 15, "lowInventoryItems": 3, "activeHealthAlerts": 1 } }` | `200` |
| `GET` | `/api/reports/egg-production` | Get egg production data over a specified period. | Authenticated | `N/A` | `{ "success": true, "data": [ { "date": "2023-10-20", "totalEggs": 40, "henDayPercentage": 80 }, { "date": "2023-10-21", "totalEggs": 42, "henDayPercentage": 84 } ] }` | `200`, `400` |
| `GET` | `/api/reports/broiler-growth` | Get broiler growth curve data for a flock. | Authenticated | `N/A` | `{ "success": true, "data": [ { "week": 1, "averageWeightG": 200, "targetWeightG": 220 }, { "week": 2, "averageWeightG": 550, "targetWeightG": 580 } ] }` | `200`, `400`, `404` |
| `GET` | `/api/reports/cost-revenue` | Get cost and revenue summary over a specified period. | Admin | `N/A` | `{ "success": true, "data": { "startDate": "2023-10-01", "endDate": "2023-10-31", "totalRevenue": 1500.00, "totalCosts": 800.00, "netProfit": 700.00 } }` | `200`, `400` |

### 8. System Configuration & Alerts

| Method | Path | Description | Auth Level | Request Body (JSON) | Response Body (JSON) | Status Codes |
|:---|:---|:---|:---|:---|:---|:---|
| `GET` | `/api/config/alerts` | Get current alert configuration settings. | Admin | `N/A` | `{ "success": true, "data": { "productionDropThreshold": 15, "mortalityCountThreshold": 2, "inventoryLowThresholdEnabled": true } }` | `200` |
| `PUT` | `/api/config/alerts` | Update alert configuration settings. | Admin | `{ "productionDropThreshold": 10, "mortalityCountThreshold": 3 }` | `{ "success": true, "data": { "productionDropThreshold": 10 } }` | `200`, `400` |
| `GET` | `/api/config/inventory-thresholds` | Get all inventory reorder thresholds. | Admin | `N/A` | `{ "success": true, "data": [ { "itemId": "inv_f1", "reorderThreshold": 150 }, { "itemId": "inv_m1", "reorderThreshold": 10 } ] }` | `200` |
| `PUT` | `/api/config/inventory-thresholds` | Update reorder threshold for a specific inventory item. | Admin | `{ "itemId": "inv_f1", "reorderThreshold": 120 }` | `{ "success": true, "data": { "itemId": "inv_f1", "reorderThreshold": 120 } }` | `200`, `400`, `404` |