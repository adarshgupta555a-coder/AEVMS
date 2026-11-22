# Frontend Guidance: Inventory Management & Rental Services

> **Module Version:** 2.0 (Phase 7 + Rental Services Update)  
> **Backend Status:** 100% Implemented & Verified (58/58 Tests Passing)  
> **Target Audience:** Frontend Engineers building Next.js / React UI in `frontend/src/app/(admin)/inventory` and `frontend/src/app/(admin)/events/[id]/inventory`.

---

## 1. Architectural Overview & RBAC

The Inventory module provides full warehouse asset tracking, double-entry stock movement ledgers, and on-demand third-party equipment rental management for events.

### 1.1 Access Control (RBAC)
- **Authorized Roles:** `ADMIN`, `SUPER_ADMIN`.
- **Restricted Roles:** `CLIENT` receives HTTP `403 FORBIDDEN` on all `/api/v1/inventory/*` routes.
- **Authentication:** All requests require standard JWT Bearer authentication:
  ```http
  Authorization: Bearer <accessToken>
  ```

### 1.2 Core Domain Concepts
1. **Ownership Type (`InventoryUsageType`):**
   - `OWNED`: Internal capital equipment stored in the company warehouse (mics, par cans, sound mixers). Dispatches decrement warehouse stock; undamaged returns increment warehouse stock.
   - `RENTED`: External equipment sourced from third-party rental vendors specifically for an event (e.g. massive LED video walls, heavy generators, specialized staging). Dispatches **bypass warehouse stock checks**; returns are sent back to the vendor without incrementing company warehouse stock.
2. **Item Classification (`InventoryItemType`):**
   - `REUSABLE`: Durable equipment assigned to and returned from events.
   - `CONSUMABLE`: Single-use supplies (wristbands, gaffer tape, confetti).
3. **Double-Entry Stock Ledger (`InventoryMovementType`):**
   - Inflows: `PURCHASE`, `ADJUSTMENT_IN`, `EVENT_RETURN`.
   - Outflows: `EVENT_ISSUE`, `ADJUSTMENT_OUT`, `DAMAGE`, `LOSS`.

---

## 2. TypeScript Interfaces & Models

Frontend engineers can import or add these interfaces into `frontend/src/types/inventory.types.ts`:

```typescript
export enum InventoryUsageType {
  OWNED = "OWNED",
  RENTED = "RENTED",
}

export enum InventoryItemType {
  REUSABLE = "REUSABLE",
  CONSUMABLE = "CONSUMABLE",
}

export enum InventoryMovementType {
  PURCHASE = "PURCHASE",
  EVENT_ISSUE = "EVENT_ISSUE",
  EVENT_RETURN = "EVENT_RETURN",
  DAMAGE = "DAMAGE",
  LOSS = "LOSS",
  ADJUSTMENT_IN = "ADJUSTMENT_IN",
  ADJUSTMENT_OUT = "ADJUSTMENT_OUT",
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string | null;
  _count?: {
    items: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string | null;
  categoryId: string;
  category?: InventoryCategory;
  itemType: InventoryItemType;
  sku: string | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  purchasePrice: number | null;
  isActive: boolean;
  metrics?: {
    currentlyAllocatedToEvents: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EventInventoryAllocation {
  id: string;
  eventId: string;
  inventoryItemId: string;
  inventoryItem: InventoryItem;
  usageType: InventoryUsageType;
  requiredQuantity: number;
  issuedQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  outstandingQuantity: number;
  // Rental Service Fields
  rentalStartDate: string | null;
  rentalEndDate: string | null;
  actualReturnDate: string | null;
  rentalDays: number | null;
  rentPerUnit: number | null;
  totalRent: number | null;
  notes: string | null;
  movements?: InventoryMovement[];
}

export interface EventInventorySummary {
  totalAllocatedItems: number;
  ownedItemsCount: number;
  rentedItemsCount: number;
  totalRentalCost: number;
  totalOutstandingQuantity: number;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  eventInventoryId: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  unitCost: number | null;
  referenceNumber: string | null;
  notes: string | null;
  movementDate: string;
  createdAt: string;
}

export interface StockAuditBreakdown {
  inflows: {
    totalPurchased: number;
    totalAdjustedIn: number;
    totalEventReturned: number;
    totalIncrements: number;
  };
  outflows: {
    totalEventIssued: number;
    totalWarehouseDamaged: number;
    totalEventDamaged: number;
    totalWarehouseLost: number;
    totalAdjustedOut: number;
    totalDecrements: number;
  };
}

export interface StockAuditResult {
  isReconciled: boolean;
  discrepancy: number;
  expectedStock: number;
  currentStock: number;
  breakdown: StockAuditBreakdown;
}
```

---

## 3. UI Views & Screen Architecture

The inventory user interface is structured across four primary views:

```
frontend/src/app/(admin)/
├── inventory/
│   ├── page.tsx                    # View 1: Master Catalog & Categories
│   ├── movements/
│   │   └── page.tsx                # View 2: Movement Ledger & Adjustments
│   └── items/
│       └── [id]/
│           └── page.tsx            # View 3: Item Detail & Mathematical Audit
└── events/
    └── [id]/
        └── inventory/
            └── page.tsx            # View 4: Event Logistics & Rental Services
```

---

### View 1: Master Catalog (`/inventory`)

**Purpose:** Master inventory directory, stock levels, low-stock alerts, and category management.

#### Component Breakdown & Wireframe
1. **Header Action Bar:**
   - Title: "Inventory Management"
   - Button: `[+ Add Item]` (Opens Add Item Modal)
   - Button: `[Categories]` (Opens Category Sheet / Modal)
   - Button: `[Stock Movements]` (Links to `/inventory/movements`)
2. **KPI Summary Cards (4 Cards):**
   - **Total SKUs:** Total active items count.
   - **Stock Health:** Items with `currentStock > minimumStock`.
   - **Low Stock Alerts:** Items with `currentStock <= minimumStock && currentStock > 0` (Yellow badge).
   - **Out of Stock:** Items with `currentStock === 0` (Red destructive badge).
3. **Filter & Search Toolbar:**
   - Search input: Searches by item name and SKU (`search=...`).
   - Category Select: Filter by category (`categoryId=...`).
   - Type Select: All, `REUSABLE`, `CONSUMABLE` (`itemType=...`).
   - Switch / Checkbox: "Show Low Stock Only" (`lowStock=true`).
4. **Item Catalog Table:**
   - Columns: Item Name & SKU, Category, Type, Unit, Current Stock, Min Stock, Purchase Price (₹), Status (`Active`/`Inactive`), Actions (`Edit`, `Audit`, `Delete`).
   - Row Highlight: Highlight row in light amber if `currentStock <= minimumStock`.

---

### View 2: Stock Movements Ledger (`/inventory/movements`)

**Purpose:** Complete immutable audit log of all warehouse stock inflows, outflows, write-offs, and purchases.

#### Component Breakdown & Wireframe
1. **Header Action Bar:**
   - Button: `[+ Record Purchase]` (Opens purchase modal, updates stock, optional cost).
   - Button: `[+/- Manual Adjustment]` (Opens adjustment modal with mandatory audit note).
   - Button: `[Report Damage / Loss]` (Opens write-off modal).
2. **Filter Toolbar:**
   - Movement Type filter: Dropdown (`PURCHASE`, `EVENT_ISSUE`, `EVENT_RETURN`, `DAMAGE`, `LOSS`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`).
   - Date range picker (`startDate`, `endDate`).
   - Item search.
3. **Movements Table:**
   - Columns: Date/Time, Item Name, Movement Type Badge, Quantity, Ref Number (e.g. `EVT-INV-1002` or PO#), Audit Notes.
   - **Movement Type Badges:**
     - `PURCHASE`: Green (`bg-emerald-500/10 text-emerald-500`)
     - `ADJUSTMENT_IN`: Green
     - `EVENT_RETURN`: Teal (`bg-teal-500/10 text-teal-500`)
     - `EVENT_ISSUE`: Blue (`bg-blue-500/10 text-blue-500`)
     - `ADJUSTMENT_OUT`: Amber (`bg-amber-500/10 text-amber-500`)
     - `DAMAGE`: Red (`bg-red-500/10 text-red-500`)
     - `LOSS`: Violet (`bg-purple-500/10 text-purple-500`)

---

### View 3: Item Detail & Mathematical Audit (`/inventory/items/[id]`)

**Purpose:** Individual SKU inspection and verification of mathematical ledger reconciliation.

#### Component Breakdown & Wireframe
1. **Item Overview Card:** SKU, Category, Minimum Stock, Purchase Price, Total Events Allocated.
2. **Reconciliation Status Card:**
   - If `isReconciled === true`:
     - Badge: `[RECONCILED: 100% AUDIT COMPLIANT]` (Green)
     - Message: "Current warehouse stock matches ledger transaction history perfectly."
   - If `isReconciled === false`:
     - Badge: `[DISCREPANCY DETECTED: ±X UNITS]` (Red Destructive)
     - Alert detailing discrepancy quantity.
3. **Double-Entry Breakdown Grid:**
   - **Inflows Column:**
     - Purchases (`totalPurchased`)
     - Positive Adjustments (`totalAdjustedIn`)
     - Event Returns (`totalEventReturned`)
     - **Total Increments**
   - **Outflows Column:**
     - Event Dispatches (`totalEventIssued`)
     - Warehouse Damages (`totalWarehouseDamaged`)
     - Event Damages (`totalEventDamaged`)
     - Warehouse Losses (`totalWarehouseLost`)
     - Negative Adjustments (`totalAdjustedOut`)
     - **Total Decrements**

---

### View 4: Event Logistics & Rental Services (`/events/[id]/inventory`)

**Purpose:** Equipment planning, third-party vendor rental tracking, dispatch, and return inspection for a specific event.

#### Component Breakdown & Wireframe
1. **Summary Metrics Banner:**
   ```
   +--------------------+-------------------+--------------------+----------------------+-------------------------+
   | Total Allocations  | Owned Equipment   | Rented Equipment   | Total Rental Cost    | Outstanding Units       |
   | 8 Items            | 6 Assets          | 2 Vendor Rentals   | ₹ 68,000.00          | 4 Pending Return        |
   +--------------------+-------------------+--------------------+----------------------+-------------------------+
   ```
2. **Dual-Tab Allocation Interface:**
   - **Tab 1: Owned Warehouse Gear (`usageType: "OWNED"`)**
     - Lists warehouse assets.
     - Column: Warehouse Available Stock vs Required Quantity.
     - Actions: `[Dispatch / Issue]` and `[Process Return]`.
   - **Tab 2: Third-Party Vendor Rentals (`usageType: "RENTED"`)**
     - Table Columns:
       - Item / Equipment Name
       - Rental Start Date
       - Rental End Date
       - Rental Duration (Days)
       - Rent / Unit (₹)
       - Total Rent (₹)
       - Issued Units
       - Actual Return Date
       - Actions: `[Edit Terms]`, `[Dispatch / On-Site Arrival]`, `[Return to Vendor]`

---

## 4. Rental Management UX & Calculations

### 4.1 Real-Time Client-Side Calculation Helper
When an admin allocates or updates rented equipment, the frontend should calculate rental days and total rent in real-time as the user types:

```typescript
export function calculateRentalMetrics(params: {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  requiredQuantity: number;
  rentPerUnit?: number | null;
}): { rentalDays: number; totalRent: number } {
  let rentalDays = 1;
  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate).getTime();
    const end = new Date(params.endDate).getTime();
    if (end >= start) {
      rentalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    }
  }

  const rate = Number(params.rentPerUnit || 0);
  const qty = Number(params.requiredQuantity || 0);
  const totalRent = Math.round(qty * rate * rentalDays * 100) / 100;

  return { rentalDays, totalRent };
}
```

### 4.2 Allocation Modal Form Design
When opening `Allocate Equipment Modal`:
1. Radio Button / Toggle: `[Company Owned]` vs. `[Third-Party Rented]`
2. If `Third-Party Rented` selected:
   - Display fields:
     - **Rental Start Date & Time** (datetime picker)
     - **Rental End Date & Time** (datetime picker)
     - **Calculated Rental Days** (auto-populated read-only input with "Days" suffix)
     - **Rent Per Unit (₹)** (number input, 2 decimal places)
     - **Total Estimated Rent (₹)** (auto-computed read-only badge)
     - **Vendor / Sourcing Notes** (e.g. "Sourced from BrightVision Rentals")

### 4.3 Dispatch / Issue Flow
- **For `OWNED` Items:** UI checks `item.currentStock >= quantity`. If insufficient, disable submit button and show alert: `"Only X units available in warehouse"`.
- **For `RENTED` Items:** UI displays helper badge: `"Third-party vendor asset — bypasses internal warehouse stock"`. Submit directly proceeds without stock constraints.

### 4.4 Return & Damage Inspection Modal
When processing returns from an event:
- Display current outstanding units: `Outstanding = Issued - (Returned + Damaged)`.
- Input 1: **Good Condition (Returned):** Number input.
- Input 2: **Damaged Units:** Number input.
- Validation: `Returned + Damaged <= Outstanding`.
- If `Damaged > 0`: Display mandatory textarea `"Damage Description & Vendor Liability Note"`.
- If item is `RENTED`: Display actual return date picker (defaults to today).

---

## 5. API Reference & Sample Payloads

All endpoints are prefixed with `/api/v1/inventory`.

### 5.1 Item Categories

#### 1. List Categories
- **`GET /api/v1/inventory/categories`**
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Inventory categories retrieved successfully.",
    "data": [
      {
        "id": "127f9f0d-188b-4c94-b2ca-671eb1fb7b38",
        "name": "Stage Lighting",
        "description": "Moving heads, par cans, truss washes",
        "_count": { "items": 14 }
      }
    ]
  }
  ```

#### 2. Create Category
- **`POST /api/v1/inventory/categories`**
- **Request Body:**
  ```json
  {
    "name": "Audio & Acoustics",
    "description": "Microphones, monitors, and digital mixers"
  }
  ```

---

### 5.2 Inventory Items Master

#### 1. List Inventory Items
- **`GET /api/v1/inventory/items?page=1&limit=20&categoryId=...&itemType=REUSABLE&lowStock=true&search=LED`**
- **Query Parameters:**
  - `page`: number (default: 1)
  - `limit`: number (default: 20)
  - `categoryId`: UUID (optional)
  - `itemType`: `"REUSABLE"` | `"CONSUMABLE"` (optional)
  - `lowStock`: `"true"` (optional, returns items where `currentStock <= minimumStock`)
  - `search`: string (optional, searches `name` and `sku`)
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Inventory items retrieved successfully.",
    "data": [
      {
        "id": "793efed6-3213-44fa-a77b-981486f85258",
        "name": "Shure QLXD24 Beta 58A Wireless Mic",
        "sku": "MIC-WIR-1001",
        "categoryId": "127f9f0d-188b-4c94-b2ca-671eb1fb7b38",
        "category": { "name": "Audio & Acoustics" },
        "itemType": "REUSABLE",
        "unit": "sets",
        "currentStock": 8,
        "minimumStock": 4,
        "purchasePrice": 65000.00,
        "isActive": true
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
  ```

#### 2. Create Inventory Item
- **`POST /api/v1/inventory/items`**
- **Request Body:**
  ```json
  {
    "name": "RGBWA LED Par Can 54x3W",
    "description": "Stage wash lights with DMX control",
    "categoryId": "127f9f0d-188b-4c94-b2ca-671eb1fb7b38",
    "itemType": "REUSABLE",
    "sku": "LED-PAR-2026",
    "unit": "pcs",
    "minimumStock": 6,
    "purchasePrice": 4500.00,
    "initialStock": 20
  }
  ```

#### 3. Update Inventory Item
- **`PUT /api/v1/inventory/items/:id`**

#### 4. Delete Inventory Item
- **`DELETE /api/v1/inventory/items/:id`**
  *(Note: Items with logged stock movements cannot be deleted; returns `400 BAD_REQUEST`).*

#### 5. Audit Item Stock (Ledger Reconciliation)
- **`GET /api/v1/inventory/items/:id/audit`**
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Inventory stock audit completed successfully.",
    "data": {
      "itemId": "793efed6-3213-44fa-a77b-981486f85258",
      "itemName": "Shure QLXD24 Beta 58A Wireless Mic",
      "audit": {
        "isReconciled": true,
        "discrepancy": 0,
        "expectedStock": 8,
        "currentStock": 8,
        "breakdown": {
          "inflows": {
            "totalPurchased": 10,
            "totalAdjustedIn": 3,
            "totalEventReturned": 3,
            "totalIncrements": 16
          },
          "outflows": {
            "totalEventIssued": 4,
            "totalWarehouseDamaged": 1,
            "totalEventDamaged": 1,
            "totalWarehouseLost": 1,
            "totalAdjustedOut": 1,
            "totalDecrements": 8
          }
        }
      }
    }
  }
  ```

---

### 5.3 Stock Movements Ledger

#### 1. Record Purchase
- **`POST /api/v1/inventory/movements/purchase`**
- **Request Body:**
  ```json
  {
    "inventoryItemId": "793efed6-3213-44fa-a77b-981486f85258",
    "quantity": 5,
    "unitCost": 62000.00,
    "notes": "PO-2026-88 Shure Authorized Distributor"
  }
  ```

#### 2. Record Stock Adjustment (Manual In / Out)
- **`POST /api/v1/inventory/movements/adjustment`**
- **Request Body:**
  ```json
  {
    "inventoryItemId": "793efed6-3213-44fa-a77b-981486f85258",
    "quantity": 2,
    "movementType": "ADJUSTMENT_IN",
    "notes": "Found in secondary repair bay during quarterly audit"
  }
  ```

#### 3. Record Warehouse Damage / Loss
- **`POST /api/v1/inventory/movements/damage-loss`**
- **Request Body:**
  ```json
  {
    "inventoryItemId": "793efed6-3213-44fa-a77b-981486f85258",
    "quantity": 1,
    "movementType": "DAMAGE",
    "notes": "Accidentally dropped during shelf reorganization"
  }
  ```

---

### 5.4 Event Equipment Logistics & Rental Services

#### 1. Get Event Allocations & Summary
- **`GET /api/v1/inventory/events/:eventId`**
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Event inventory allocations retrieved successfully.",
    "data": {
      "event": {
        "id": "73d32505-c939-4018-ba22-e453564cbc27",
        "eventNumber": "EVT-2026-0042",
        "title": "Sunburn Arena Concert",
        "status": "CONFIRMED",
        "eventDate": "2026-12-05T18:00:00.000Z"
      },
      "summary": {
        "totalAllocatedItems": 2,
        "ownedItemsCount": 1,
        "rentedItemsCount": 1,
        "totalRentalCost": 75000.00,
        "totalOutstandingQuantity": 14
      },
      "allocations": [
        {
          "id": "alloc-1",
          "eventId": "73d32505-c939-4018-ba22-e453564cbc27",
          "inventoryItemId": "item-mic-1",
          "usageType": "OWNED",
          "requiredQuantity": 4,
          "issuedQuantity": 4,
          "returnedQuantity": 0,
          "damagedQuantity": 0,
          "outstandingQuantity": 4,
          "rentalStartDate": null,
          "rentalEndDate": null,
          "actualReturnDate": null,
          "rentalDays": null,
          "rentPerUnit": null,
          "totalRent": null,
          "notes": "Main vocal mics"
        },
        {
          "id": "alloc-2",
          "eventId": "73d32505-c939-4018-ba22-e453564cbc27",
          "inventoryItemId": "item-led-2",
          "usageType": "RENTED",
          "requiredQuantity": 10,
          "issuedQuantity": 10,
          "returnedQuantity": 0,
          "damagedQuantity": 0,
          "outstandingQuantity": 10,
          "rentalStartDate": "2026-12-04T10:00:00.000Z",
          "rentalEndDate": "2026-12-07T10:00:00.000Z",
          "actualReturnDate": null,
          "rentalDays": 3,
          "rentPerUnit": 2500.00,
          "totalRent": 75000.00,
          "notes": "Sourced from BrightVision Rentals Ltd"
        }
      ]
    }
  }
  ```

#### 2. Allocate Equipment to Event
- **`POST /api/v1/inventory/events/:eventId/allocate`**
- **Request Body (Supports both Owned and Rented):**
  ```json
  {
    "items": [
      {
        "inventoryItemId": "item-mic-1",
        "requiredQuantity": 4,
        "usageType": "OWNED",
        "notes": "Main stage vocal mics"
      },
      {
        "inventoryItemId": "item-led-2",
        "requiredQuantity": 10,
        "usageType": "RENTED",
        "rentalStartDate": "2026-12-04T10:00:00.000Z",
        "rentalEndDate": "2026-12-07T10:00:00.000Z",
        "rentPerUnit": 2500.00,
        "notes": "Sourced from BrightVision Rentals Ltd"
      }
    ]
  }
  ```

#### 3. Update Event Item Terms / Rates (Rental Adjustment)
- **`PUT /api/v1/inventory/events/:eventId/items/:inventoryItemId`**
- **Request Body:**
  ```json
  {
    "rentPerUnit": 2200.00,
    "rentalEndDate": "2026-12-08T10:00:00.000Z",
    "notes": "Extended rental by 1 day; negotiated discount"
  }
  ```

#### 4. Issue Equipment to Event
- **`POST /api/v1/inventory/events/:eventId/issue`**
- **Request Body:**
  ```json
  {
    "items": [
      {
        "inventoryItemId": "item-mic-1",
        "quantity": 4,
        "notes": "Dispatched in flight case 3"
      },
      {
        "inventoryItemId": "item-led-2",
        "quantity": 10,
        "usageType": "RENTED",
        "notes": "Vendor delivered directly on-site"
      }
    ]
  }
  ```

#### 5. Return Equipment from Event
- **`POST /api/v1/inventory/events/:eventId/return`**
- **Request Body:**
  ```json
  {
    "items": [
      {
        "inventoryItemId": "item-led-2",
        "returnedQuantity": 9,
        "damagedQuantity": 1,
        "actualReturnDate": "2026-12-08T14:30:00.000Z",
        "notes": "9 panels returned to vendor in good condition; 1 panel damaged during teardown"
      }
    ]
  }
  ```

---

## 6. Common Frontend Error Handling

| HTTP Code | Error Code | Common Cause | User-Friendly Toast / Notification |
| :--- | :--- | :--- | :--- |
| **`400`** | `BAD_REQUEST` | Insufficient stock for owned item issue | *"Cannot issue gear: Requested X units, but only Y units are available in the warehouse."* |
| **`400`** | `BAD_REQUEST` | Over-return attempt | *"Attempted return exceeds unreturned outstanding quantity."* |
| **`400`** | `BAD_REQUEST` | Deleting item with history | *"Cannot delete this item because stock movement records are attached. Consider deactivating it instead."* |
| **`403`** | `FORBIDDEN` | Client user accessing inventory | *"Access denied. Inventory management is restricted to administrators."* |
| **`404`** | `NOT_FOUND` | Item or event allocation not found | *"The requested item or event allocation could not be found."* |
| **`409`** | `CONFLICT` | Duplicate SKU or Category name | *"An item with this SKU or category name already exists."* |
| **`422`** | `VALIDATION_ERROR` | Missing audit note in adjustment | *"Please provide mandatory audit notes explaining this stock adjustment."* |
