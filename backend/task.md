# Event Management System (EMS) — Backend Task & Implementation Plan

> [!CAUTION]
> ### STRICT ARCHITECTURAL RULE: ZERO SCHEMA MODIFICATIONS
> **NEVER MAKE ANY CHANGES TO THE PRISMA SCHEMA FILE (`backend/prisma/schema.prisma`).**  
> **NEVER RUN `prisma migrate reset`, `prisma db push`, OR GENERATE NEW MIGRATIONS.**  
> The existing Prisma schema and database migration (`20261109204135_init`) are **authoritative and locked**. All backend code, models, enums, relations, foreign keys, and queries must conform strictly and directly to the existing schema as currently deployed.

---

## Document Overview
This document specifies the complete, granular task list for developing the EMS Node.js + Express + TypeScript backend. Every task is derived from:
- [docs/LLD.md](file:///C:/Users/N/Documents/projects/EMS/docs/LLD.md)
- [docs/IMPLEMENTATION_ROADMAP.md](file:///C:/Users/N/Documents/projects/EMS/docs/IMPLEMENTATION_ROADMAP.md)
- [docs/OPEN_QUESTIONS.md](file:///C:/Users/N/Documents/projects/EMS/docs/OPEN_QUESTIONS.md)
- [backend/prisma/schema.prisma](file:///C:/Users/N/Documents/projects/EMS/backend/prisma/schema.prisma)

---

## 1. Phase 1: Backend Foundation, Configuration & Core Infrastructure

### 1.1 Package Scripts & Entry Point Alignment
- [x] **Task 1.1.1 — Align `package.json` scripts:**
  - Update `"dev"` script: Change `tsx watch src/index.ts` to `tsx watch src/server.ts`.
  - Update `"start"` script: Change `node dist/index.js` to `node dist/server.js`.
  - Verify `package.json` build and watch commands.
  - *Target file:* `backend/package.json`
- [x] **Task 1.1.2 — Create non-secret environment template (`.env.example`):**
  - Document placeholder keys without printing secrets:
    `DATABASE_URL`, `DIRECT_URL`, `PORT`, `NODE_ENV`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `CORS_ORIGIN`.
  - *Target file:* `backend/.env.example`

### 1.2 Prisma Client Singleton & PostgreSQL Driver Adapter
- [x] **Task 1.2.1 — Populate Prisma singleton in `src/lib/prisma.ts`:**
  - Implement reusable, lazily instantiated `PrismaClient` with `@prisma/adapter-pg` and pooled connection.
  - Attach client to `globalThis` in development to prevent connection exhaustion during hot-reloads.
  - Re-export `PrismaClient` and `Prisma` namespace types.
  - *Target file:* `backend/src/lib/prisma.ts`
- [x] **Task 1.2.2 — Update database configuration:**
  - Refactor `src/config/database.ts` to export the unified client from `src/lib/prisma.ts`.
  - Add graceful connection testing and disconnect hooks on `SIGINT` / `SIGTERM`.
  - *Target file:* `backend/src/config/database.ts`

### 1.3 Environment Validation & Centralized Error Handling
- [x] **Task 1.3.1 — Expand Zod environment schema (`src/config/env.ts`):**
  - Add validation for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT` (default 5000), `NODE_ENV` (dev/prod/test), `CORS_ORIGIN`.
  - *Target file:* `backend/src/config/env.ts`
- [x] **Task 1.3.2 — Implement standardized Error Classes (`src/utils/errors.ts`):**
  - Create `AppError` base class extending `Error` (with `statusCode`, `errorCode`, `details`).
  - Implement subclasses: `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError` (422).
  - *Target file:* `backend/src/utils/errors.ts`
- [x] **Task 1.3.3 — Enhance centralized error middleware (`src/middlewares/error.middleware.ts`):**
  - Map Prisma errors: `P2002` (Unique constraint) → `409 Conflict`, `P2025` (Record not found) → `404 Not Found`, `P2003` (Foreign key violation) → `400 Bad Request`.
  - Map Zod validation errors to standardized field-level error messages.
  - Sanitize internal error messages in production mode.
  - *Target file:* `backend/src/middlewares/error.middleware.ts`
- [x] **Task 1.3.4 — Standard JSON API response helper (`src/utils/response.ts`):**
  - Implement `sendSuccess(res, data, message, statusCode, meta)` and `sendError(res, error)`.
  - Format: `{ success: true, data: ..., message?: string, meta?: { page, limit, total, totalPages } }`.
  - *Target file:* `backend/src/utils/response.ts`
- [x] **Task 1.3.5 — Request validation middleware (`src/middlewares/validate.middleware.ts`):**
  - Create generic Express middleware accepting Zod schemas for `{ body, query, params }`.
  - *Target file:* `backend/src/middlewares/validate.middleware.ts`

---

## 2. Phase 2: Authentication, Session Management & Access Control

### 2.1 Password Security & Initial Seed
- [ ] **Task 2.1.1 — Password utility (`src/utils/password.ts`):**
  - Implement `hashPassword(password: string): Promise<string>` using `bcrypt` (work factor 12).
  - Implement `comparePassword(password: string, hash: string): Promise<boolean>`.
  - *Target file:* `backend/src/utils/password.ts`
- [ ] **Task 2.1.2 — Admin provisioning seed CLI script (`src/scripts/seedAdmin.ts`):**
  - Create standalone script checking if an admin `User` exists; if not, create initial Admin with `role = USERROLE.ADMIN` and `clientId = null`.
  - Add script to `package.json`: `"seed:admin": "tsx src/scripts/seedAdmin.ts"`.
  - *Target file:* `backend/src/scripts/seedAdmin.ts`

### 2.2 JWT Tokens & Token Rotation Service
- [x] **Task 2.2.1 — Token utility (`src/utils/jwt.ts`):**
  - Implement Access Token generation (15 min) with payload: `{ sub: userId, role: USERROLE, clientId: string | null }`.
  - Implement Refresh Token generation (7 days, cryptographically secure random string).
  - Implement SHA-256 token hashing for database storage in `RefreshToken.tokenHash`.
  - *Target file:* `backend/src/utils/jwt.ts`
- [x] **Task 2.2.2 — Cookie configuration helper (`src/utils/cookies.ts`):**
  - Set and clear HttpOnly, Secure (in production), SameSite cookies: `access_token` and `refresh_token`.
  - *Target file:* `backend/src/utils/cookies.ts`
- [x] **Task 2.2.3 — Authentication Service (`src/services/auth.service.ts`):**
  - `login(email, password)`: Verify user, check `isActive`, compare password, mint access/refresh tokens, save hashed refresh token to `RefreshToken` table.
  - `refresh(refreshTokenString)`: Look up active token by hash, detect reuse (revoke family if reused), issue fresh pair, update `expiresAt` / `revokedAt`.
  - `logout(refreshTokenString)`: Set `revokedAt = new Date()` for the token.
  - `getCurrentUser(userId)`: Return sanitized user object and linked `Client` details (if role is CLIENT).
  - *Target file:* `backend/src/services/auth.service.ts`
- [x] **Task 2.2.4 — Auth Controller & Routes:**
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
  - *Target files:* `backend/src/controllers/auth.controller.ts`, `backend/src/routes/auth.routes.ts`, `backend/src/validations/auth.validation.ts`

### 2.3 Role & Ownership Authorization Middlewares
- [x] **Task 2.3.1 — Authentication Middleware (`src/middlewares/auth.middleware.ts`):**
  - Extract JWT from HttpOnly cookie `access_token` or `Authorization: Bearer <token>`.
  - Verify signature and populate `req.user = { id, role, clientId }`.
  - Return `401 Unauthorized` on missing, invalid, or expired tokens.
  - *Target file:* `backend/src/middlewares/auth.middleware.ts`
- [x] **Task 2.3.2 — Role Guard Middleware (`src/middlewares/role.middleware.ts`):**
  - `requireRole(USERROLE.ADMIN)`: Reject non-admins with `403 Forbidden`.
  - *Target file:* `backend/src/middlewares/role.middleware.ts`
- [x] **Task 2.3.3 — Client Ownership Scoping Helper (`src/utils/ownership.ts`):**
  - Utility to verify that Client users can only access entities where `clientId === req.user.clientId`.
  - *Target file:* `backend/src/utils/ownership.ts`

---

## 3. Phase 3: Client Management Module

### 3.1 Client Layer (`services`, `controllers`, `routes`, `validations`)
- [x] **Task 3.1.1 — Client Validation Schemas (`src/validations/client.validation.ts`):**
  - Create client: `name` (string, required), `phone` (10-digit Indian format), `email` (optional valid email), `address`, `city`, `notes`.
  - Update client: optional fields.
  - Query parameters: pagination (`page`, `limit`), `search` (name, phone, email).
  - *Target file:* `backend/src/validations/client.validation.ts`
- [x] **Task 3.1.2 — Client Service (`src/services/client.service.ts`):**
  - `createClient(data)`: Insert client into `Client` table.
  - `getClients(query)`: Paginated search by name, phone, city with event and invoice counts (`_count`).
  - `getClientById(id)`: Detailed client profile including event history, quotations, invoices, payments.
  - `updateClient(id, data)`: Update client fields.
  - `deleteClient(id)`: Validate no active events or unpaid invoices exist; prevent deletion if relations exist (Prisma `Restrict`).
  - `linkUserAccount(clientId, userId)`: Connect an existing `Client` to a `User` login account.
  - *Target file:* `backend/src/services/client.service.ts`
- [x] **Task 3.1.3 — Client Controller & Routes:**
  - `GET /api/v1/clients` (Admin)
  - `POST /api/v1/clients` (Admin - Creates client profile ONLY, no user account)
  - `GET /api/v1/clients/:id` (Admin, or Client if `id === req.user.clientId`)
  - `PUT /api/v1/clients/:id` (Admin)
  - `DELETE /api/v1/clients/:id` (Admin)
  - `POST /api/v1/clients/:id/link-user` (Admin)
  - `POST /api/v1/clients/:id/assign-portal` (Admin - assigns portal, creates inactive User, generates expiring invitation token, sends email)
  - `GET /api/v1/clients/:id/portal-status` (Admin - checks status: NOT_ASSIGNED, INVITATION_PENDING, INVITATION_EXPIRED, ACTIVE)
  - `POST /api/v1/clients/:id/resend-invite` (Admin - generates fresh invitation token and resends email)
  - `POST /api/v1/auth/activate-portal` (Client - verifies invitation token, sets own password, activates account, logs in)
  - `PATCH /api/v1/admin/clients/:clientId/status` (Admin - activates/deactivates client portal login access, revokes active refresh tokens upon deactivation, records audit reason)
  - `GET /api/v1/admin/clients/:clientId/events` (Admin / matching Client - client's event history)
  - `GET /api/v1/admin/clients/:clientId/quotations` (Admin / matching Client - client's quotations history)
  - `GET /api/v1/admin/clients/:clientId/invoices` (Admin / matching Client - client's invoices)
  - `GET /api/v1/admin/clients/:clientId/payments` (Admin / matching Client - client's payment history)
  - `GET /api/v1/admin/clients/:clientId/activities` (Admin / matching Client - client's meetings, calls & activities)
  - `POST /api/v1/admin/clients/:clientId/activities` (Admin - create meeting, call or activity for client)
  - *Target files:* `backend/src/controllers/client.controller.ts`, `backend/src/routes/client.routes.ts`, `backend/src/services/email.service.ts`

### 3.2 Calendar & Client Activities Layer (`CalendarEntry`)
- [x] **Task 3.2.1 — Calendar Validation Schemas (`src/validations/calendar.validation.ts`):**
  - Create entry: `title`, `description`, `type` (`MEETING`, `SITE_VISIT`, `VENDOR_MEETING`, `OFFICE_ACTIVITY`, `OTHER`), `startAt`, `endAt`, `allDay`, `location`, `clientId`, `eventId`.
  - Date validation: `endAt >= startAt`.
  - Filter query: `from`, `to`, `type`, `clientId`, `eventId`, `search`, `page`, `limit`.
  - *Target file:* `backend/src/validations/calendar.validation.ts`
- [x] **Task 3.2.2 — Calendar & Activity Service (`src/services/calendar.service.ts`):**
  - `createEntry(data, userId)`: Link to client, validate event ownership if provided, record `createdById`.
  - `getEntries(query, user)`: Chronological ordering, filter by date range, type, search keyword; RBAC scoped (Admin all, Client own).
  - `getEntryById(id, user)`: Retrieve single entry with client and event details (IDOR protected).
  - `updateEntry(id, data)`: Modify entry details (Admin only).
  - `deleteEntry(id)`: Remove entry (Admin only).
  - `getClientActivities(clientId, query)`: Return client-specific activity timeline with pagination.
  - *Target file:* `backend/src/services/calendar.service.ts`
- [x] **Task 3.2.3 — Calendar Controller & Routes (`src/controllers/calendar.controller.ts`, `src/routes/calendar.routes.ts`):**
  - `GET /api/v1/calendar`
  - `POST /api/v1/calendar`
  - `GET /api/v1/calendar/:id`
  - `PUT /api/v1/calendar/:id`
  - `DELETE /api/v1/calendar/:id`
  - `GET /api/v1/clients/:id/activities` (and `/calendar`)
  - `POST /api/v1/clients/:id/activities` (and `/calendar`)
  - *Target files:* `backend/src/controllers/calendar.controller.ts`, `backend/src/routes/calendar.routes.ts`

---

## 4. Phase 4: Event Management & Lifecycle Module

### 4.1 Event Layer (`services`, `controllers`, `routes`, `validations`)
- [x] **Task 4.1.1 — Safe Event Number Generator (`src/utils/sequence.ts`):**
  - Generate thread-safe sequential event numbers: `EVT-YYYY-XXXX` (e.g., `EVT-2026-0001`).
  - *Target file:* `backend/src/utils/sequence.ts`
- [x] **Task 4.1.2 — Event Validation Schemas (`src/validations/event.validation.ts`):**
  - Create event: `clientId`, `title`, `eventType`, `eventDate`, `startTime`, `endTime`, `venueName`, `venueAddress`, `guestCount`, `budget` (Decimal >= 0), `notes`, `quotationId` (optional).
  - Status transition schema: validate target status against `EventStatus` enum.
  - Query filters: `status`, `from`, `to`, `clientId`, `search`.
  - *Target file:* `backend/src/validations/event.validation.ts`
- [x] **Task 4.1.3 — Event State Machine & Service (`src/services/event.service.ts`):**
  - `createEvent(data, userId)`: Validate client, auto-generate `eventNumber`, set initial status `DRAFT`, record `createdById`.
  - `getEvents(query, user)`: Admin sees all events; Client sees only events where `clientId === user.clientId`.
  - `getEventById(id, user)`: Return event details. Strip internal vendor costs and margins if actor is Client.
  - `updateEvent(id, data)`: Update planning details and budget.
  - `updateStatus(id, newStatus)`: Enforce allowed transitions:
    `DRAFT` → `CONFIRMED` → `PLANNING` → `IN_PROGRESS` → `COMPLETED`; any non-completed state → `CANCELLED`.
  - `getEventSummary(id)`: Calculate event financial summary (Budget planning value, total invoiced, total payments received, total event expenses, balance receivable).
  - *Target file:* `backend/src/services/event.service.ts`
- [x] **Task 4.1.4 — Event Controller & Routes:**
  - `GET /api/v1/events` (Admin: all, Client: own)
  - `POST /api/v1/events` (Admin)
  - `GET /api/v1/events/:id` (Admin / Client with ownership check)
  - `PUT /api/v1/events/:id` (Admin)
  - `PATCH /api/v1/events/:id/status` (Admin)
  - `GET /api/v1/events/:id/summary` (Admin only)
  - *Target files:* `backend/src/controllers/event.controller.ts`, `backend/src/routes/event.routes.ts`

### 4.2 Event Tasks & Event Schedules (Operational Sub-modules)
- [x] **Task 4.2.1 — Event Schedule Service (`src/services/schedule.service.ts` / `src/services/event.service.ts`):**
  - CRUD for `EventSchedule` (`eventId`, `title`, `description`, `startAt`, `endAt`).
  - *Target file:* `backend/src/services/event.service.ts`
- [x] **Task 4.2.2 — Event Task Service (`src/services/task.service.ts` / `src/services/event.service.ts`):**
  - Operational checklist tracking for `EventTask` (`eventId`, `title`, `description`, `dueDate`, `status` [`TODO`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`], `priority`).
  - *Target file:* `backend/src/services/event.service.ts`

---

## 5. Phase 5: Quotation Management Module

### 5.1 Quotation Layer (`services`, `controllers`, `routes`, `validations`)
- [x] **Task 5.1.1 — Quotation Number Generator & Validation (`src/validations/quotation.validation.ts`):**
  - Generate sequence `QUO-YYYY-XXXX`.
  - Validate quotation fields and line items (`itemName`, `quantity`, `unitPrice`, `sortOrder`).
  - *Target file:* `backend/src/validations/quotation.validation.ts`
- [x] **Task 5.1.2 — Quotation Service (`src/services/quotation.service.ts`):**
  - `createQuotation(data, userId)`: Compute item totals, subtotal, discount, tax, totalAmount with Decimal precision; insert `Quotation` and `QuotationItem` in `prisma.$transaction`.
  - `getQuotations(query, user)`: Scoped by client for Client users; all for Admin.
  - `getQuotationById(id, user)`: Retrieve quotation with line items.
  - `updateQuotationStatus(id, status)`: Support `DRAFT`, `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`.
  - `convertToEvent(id)`: Transition quotation to `ACCEPTED` and link to created `Event` via `Event.quotationId`.
  - *Target file:* `backend/src/services/quotation.service.ts`
- [x] **Task 5.1.3 — Quotation Controller & Routes:**
  - `GET /api/v1/quotations`
  - `POST /api/v1/quotations`
  - `GET /api/v1/quotations/:id`
  - `PATCH /api/v1/quotations/:id/status`
  - `POST /api/v1/quotations/:id/convert-to-event`
  - *Target files:* `backend/src/controllers/quotation.controller.ts`, `backend/src/routes/quotation.routes.ts`

---

## 6. Phase 6: Invoices & Client Payment Engine

### 6.1 Itemized Invoicing
- [x] **Task 6.1.1 — Invoice Validation (`src/validations/invoice.validation.ts`):**
  - Sequential invoice number: `INV-YYYY-XXXX`.
  - Schema for invoice creation: `clientId`, `eventId` (optional), `title`, `invoiceDate`, `dueDate`, `discountType`, `discountValue`, `taxRate`, `notes`, `terms`, and `items` array.
  - Schema for item: `itemName`, `description`, `quantity`, `unitPrice`, `type` (`PROFORMA` / `FINAL`), `quotationId` (optional), `advanceAdjusted`.
  - *Target file:* `backend/src/validations/invoice.validation.ts`
- [x] **Task 6.1.2 — Decimal Arithmetic Helpers (`src/utils/decimal.ts`):**
  - Decimal math helpers for subtotal, discount, tax, and totals using `Prisma.Decimal`.
  - *Target file:* `backend/src/utils/decimal.ts`
- [x] **Task 6.1.3 — Invoice Service (`src/services/invoice.service.ts`):**
  - `createInvoice(data, userId)`: Execute inside `prisma.$transaction`. Compute line item totals, subtotal, discount, tax, grand total; insert `Invoice` and `InvoiceItem`.
  - `getInvoices(query, user)`: Scoped for Client users; full search/filter for Admin.
  - `getInvoiceById(id, user)`: Include items, payment allocations, proforma advance links.
  - `updateInvoiceStatus(id, status)`: Support `DRAFT`, `SENT`, `CANCELLED`.
  - `calculateBalance(invoiceId)`: Derive `totalAmount - sum(PaymentAllocation.amount)`.
  - *Target file:* `backend/src/services/invoice.service.ts`
- [x] **Task 6.1.4 — Invoice Controller & Routes:**
  - `GET /api/v1/invoices`
  - `POST /api/v1/invoices`
  - `GET /api/v1/invoices/:id`
  - `PATCH /api/v1/invoices/:id/status`
  - *Target files:* `backend/src/controllers/invoice.controller.ts`, `backend/src/routes/invoice.routes.ts`

### 6.2 Client Payment Recording & Multi-Invoice Allocations
- [x] **Task 6.2.1 — Payment Validation (`src/validations/payment.validation.ts`):**
  - Payment creation schema: `clientId`, `eventId` (optional), `proformaInvoiceId` (optional), `amount`, `paymentType` (`ADVANCE`, `PARTIAL`, `FULL`, `OTHER`), `paymentMethod` (`CASH`, `UPI`, `BANK_TRANSFER`, `CARD`, `CHEQUE`, `OTHER`), `paymentDate`, `transactionReference`, `notes`, `allocations` array (`invoiceId`, `amount`).
  - *Target file:* `backend/src/validations/payment.validation.ts`
- [x] **Task 6.2.2 — Payment Service (`src/services/payment.service.ts`):**
  - `recordPayment(data, userId)`: Execute in `prisma.$transaction`:
    1. Validate total allocation amount does not exceed payment `amount`.
    2. For each allocation, verify invoice exists and allocated amount does not exceed invoice's remaining balance.
    3. Generate sequential payment number: `PAY-YYYY-XXXX`.
    4. Insert `Payment` row.
    5. Insert `PaymentAllocation` rows (`paymentId`, `invoiceId`, `amount`).
    6. Recompute and update each affected `Invoice.status` (`PAID` if balance is 0, `PARTIALLY_PAID` if balance > 0).
  - `getPayments(query, user)`: Filter payments by client, event, date range, payment method.
  - `getPaymentById(id, user)`: Retrieve payment with allocation details.
  - *Target file:* `backend/src/services/payment.service.ts`
- [x] **Task 6.2.3 — Payment Controller & Routes:**
  - `GET /api/v1/payments`
  - `POST /api/v1/payments`
  - `GET /api/v1/payments/:id`
  - *Target files:* `backend/src/controllers/payment.controller.ts`, `backend/src/routes/payment.routes.ts`

---

## 7. Phase 7: Inventory Management & Movement Ledger

### 7.1 Categories & Item Master
- [ ] **Task 7.1.1 — Inventory Validation Schemas (`src/validations/inventory.validation.ts`):**
  - Category schema: `name` (unique), `description`.
  - Item schema: `name`, `categoryId`, `itemType` (`REUSABLE`, `CONSUMABLE`), `sku` (unique), `unit`, `minimumStock`, `purchasePrice`.
  - *Target file:* `backend/src/validations/inventory.validation.ts`
- [ ] **Task 7.1.2 — Item Master Service (`src/services/inventoryItem.service.ts`):**
  - Category CRUD.
  - Item CRUD with `currentStock` tracking (default 0).
  - Low-stock query: `where: { currentStock: { lte: minimumStock } }`.
  - *Target file:* `backend/src/services/inventoryItem.service.ts`

### 7.2 Movement Ledger & Event Allocation Operations
- [ ] **Task 7.2.1 — Inventory Movement Service (`src/services/inventoryMovement.service.ts`):**
  - `recordPurchase(itemId, quantity, unitCost, referenceNumber, expenseId, notes)`:
    In `prisma.$transaction`: insert `InventoryMovement` (`movementType = PURCHASE`), increment `InventoryItem.currentStock += quantity`.
  - `recordManualAdjustment(itemId, quantity, type, notes)`:
    Validate `type === ADJUSTMENT_IN` or `ADJUSTMENT_OUT`. Adjust stock accordingly and log movement.
  - `reconcileStock(itemId)`: Compute sum of movements and compare against `InventoryItem.currentStock`.
  - *Target file:* `backend/src/services/inventoryMovement.service.ts`
- [ ] **Task 7.2.2 — Event Inventory Issue & Return Service (`src/services/eventInventory.service.ts`):**
  - `issueToEvent(eventId, inventoryItemId, quantity, notes)`:
    In `prisma.$transaction`:
    1. Check `InventoryItem.currentStock >= quantity`; throw `BadRequestError` if insufficient.
    2. Decrement `InventoryItem.currentStock -= quantity`.
    3. Upsert `EventInventory` (`eventId, inventoryItemId`), increment `issuedQuantity += quantity`.
    4. Log `InventoryMovement` (`movementType = EVENT_ISSUE`, `eventInventoryId`).
  - `returnFromEvent(eventId, inventoryItemId, returnedQty, damagedQty, notes)`:
    In `prisma.$transaction`:
    1. Validate `(returnedQty + damagedQty) <= (EventInventory.issuedQuantity - EventInventory.returnedQuantity - EventInventory.damagedQuantity)`.
    2. Increment `InventoryItem.currentStock += returnedQty` (undamaged returns only).
    3. Update `EventInventory` (`returnedQuantity += returnedQty`, `damagedQuantity += damagedQty`).
    4. Log `InventoryMovement` (`EVENT_RETURN` for returnedQty).
    5. If `damagedQty > 0`: Log `InventoryMovement` (`DAMAGE` for damagedQty; damaged items do NOT return to available stock).
  - *Target file:* `backend/src/services/eventInventory.service.ts`
- [ ] **Task 7.2.3 — Inventory Controllers & Routes:**
  - `GET /api/v1/inventory/categories`
  - `POST /api/v1/inventory/categories`
  - `GET /api/v1/inventory/items`
  - `POST /api/v1/inventory/items`
  - `GET /api/v1/inventory/items/:id`
  - `PUT /api/v1/inventory/items/:id`
  - `POST /api/v1/inventory/movements/purchase`
  - `POST /api/v1/inventory/movements/adjustment`
  - `POST /api/v1/inventory/events/issue`
  - `POST /api/v1/inventory/events/return`
  - *Target files:* `backend/src/controllers/inventory.controller.ts`, `backend/src/routes/inventory.routes.ts`

---

## 8. Phase 8: Tie-Up & Collaboration Management

### 8.1 Partner Master & Security Deposit Ledger
- [ ] **Task 8.1.1 — Tie-Up Validation Schemas (`src/validations/tieup.validation.ts`):**
  - Partner schema: `name`, `type` (`RESTAURANT`, `HOTEL`), `status` (`ACTIVE`, `INACTIVE`, `TERMINATED`), `contactPerson`, `phone`, `email`, `address`, `city`, `commissionType` (`FIXED`, `PERCENTAGE`), `commissionValue`.
  - Transaction schema: `transactionType` (`SECURITY_DEPOSIT_PAID`, `SECURITY_DEPOSIT_REFUNDED`, `COMMISSION_RECEIVED`, `OTHER_INCOME`, `OTHER_EXPENSE`), `amount`, `referenceNumber`, `notes`, `tieUpEventId` (optional).
  - Link event schema: `tieUpId`, `eventId`, `commissionType`, `commissionValue`, `commissionBaseAmount` (optional), `notes`.
  - *Target file:* `backend/src/validations/tieup.validation.ts`
- [ ] **Task 8.1.2 — Tie-Up Service (`src/services/tieup.service.ts`):**
  - `createTieUp(data)`: Create partner profile.
  - `getTieUps(query)`: List partners with deposit balances and event counts.
  - `getTieUpById(id)`: Detailed profile with linked events and transaction history.
  - `recordDepositTransaction(tieUpId, data)`: In `prisma.$transaction`:
    - If `SECURITY_DEPOSIT_PAID`: increment `TieUp.securityDeposit += amount`.
    - If `SECURITY_DEPOSIT_REFUNDED`: check `refundAmount <= TieUp.securityDeposit`, decrement `TieUp.securityDeposit -= amount`.
    - Insert `TieUpTransaction` record.
  - *Target file:* `backend/src/services/tieup.service.ts`

### 8.2 Event Linking & Commission Snapshot
- [ ] **Task 8.2.1 — Tie-Up Event Link Service (`src/services/tieUpEvent.service.ts`):**
  - `linkEvent(data)`:
    1. Compute `commissionAmount`:
       - If `FIXED`: `commissionAmount = commissionValue`.
       - If `PERCENTAGE`: validate `commissionBaseAmount > 0`, compute `commissionAmount = commissionBaseAmount * (commissionValue / 100)`.
    2. Insert `TieUpEvent` record storing snapshot terms (`commissionType`, `commissionValue`, `commissionBaseAmount`, `commissionAmount`).
  - `getEventTieUps(eventId)`: List partners and frozen commission snapshots for an event.
  - *Target file:* `backend/src/services/tieUpEvent.service.ts`
- [ ] **Task 8.2.2 — Tie-Up Controllers & Routes:**
  - `GET /api/v1/tie-ups`
  - `POST /api/v1/tie-ups`
  - `GET /api/v1/tie-ups/:id`
  - `PUT /api/v1/tie-ups/:id`
  - `POST /api/v1/tie-ups/:id/transactions`
  - `POST /api/v1/tie-ups/link-event`
  - `GET /api/v1/tie-ups/events/:eventId`
  - *Target files:* `backend/src/controllers/tieup.controller.ts`, `backend/src/routes/tieup.routes.ts`

---

## 9. Phase 9: Expense Management & Owner Withdrawals

### 9.1 Operating & Capital Expenses
- [ ] **Task 9.1.1 — Expense Validation Schemas (`src/validations/expense.validation.ts`):**
  - Create expense: `title`, `description`, `amount` (Decimal > 0), `scope` (`EVENT`, `BUSINESS`), `category` (`TRANSPORTATION`, `BANQUET_COMMISSION`, `OTHER_OPERATING`, `INVENTORY_PURCHASE`), `expenseDate`, `paidTo`, `receiptUrl`, `eventId` (optional), `tieUpEventId` (optional).
  - Validation rules:
    - If `scope === EVENT`: `eventId` is **required**.
    - If `scope === BUSINESS`: `eventId` must be **null**.
    - If `category === BANQUET_COMMISSION`: `tieUpEventId` is **required**; its linked event must match `eventId`.
  - Expense payment schema: `amount` (Decimal > 0), `paymentMethod`, `paidAt`, `referenceNo`, `note`.
  - *Target file:* `backend/src/validations/expense.validation.ts`
- [ ] **Task 9.1.2 — Expense Service (`src/services/expense.service.ts`):**
  - `createExpense(data, userId)`: Validate scope/category rules; insert `Expense`.
  - `createInventoryPurchaseExpense(data, movements, userId)`: In `prisma.$transaction`:
    1. Create `Expense` (`scope = BUSINESS`, `category = INVENTORY_PURCHASE`).
    2. For each purchase item, create `InventoryMovement` (`PURCHASE`) linked to `expense.id` and increment item stock.
  - `recordExpensePayment(expenseId, paymentData, userId)`: In `prisma.$transaction`:
    1. Validate `paymentData.amount + existingPayments <= Expense.amount`.
    2. Insert `ExpensePayment` record.
  - `getExpenses(query)`: Filter by scope, category, event, date range, payee.
  - `getExpenseById(id)`: Return expense, linked payments, and linked inventory movements.
  - *Target file:* `backend/src/services/expense.service.ts`
- [ ] **Task 9.1.3 — Expense Controllers & Routes:**
  - `GET /api/v1/expenses`
  - `POST /api/v1/expenses`
  - `POST /api/v1/expenses/inventory-purchase`
  - `GET /api/v1/expenses/:id`
  - `POST /api/v1/expenses/:id/payments`
  - *Target files:* `backend/src/controllers/expense.controller.ts`, `backend/src/routes/expense.routes.ts`

### 9.2 Owner / Personal Withdrawals
- [ ] **Task 9.2.1 — Owner Withdrawal Service (`src/services/withdrawal.service.ts`):**
  - Validation: `amount` (Decimal > 0), `withdrawalDate`, `paymentMethod`, `purpose`, `referenceNo`, `note`.
  - `recordWithdrawal(data, userId)`: Insert into `OwnerWithdrawal` table.
  - `getWithdrawals(query)`: List withdrawals by date range.
  - **Accounting Isolation Rule:** Ensure `OwnerWithdrawal` queries are completely segregated from `Expense` queries and never reduce event operating profit.
  - *Target files:* `backend/src/services/withdrawal.service.ts`, `backend/src/controllers/withdrawal.controller.ts`, `backend/src/routes/withdrawal.routes.ts`

---

## 10. Phase 10: Operational Dashboard & Financial Reporting Engine

### 10.1 Reports & Aggregations Service
- [ ] **Task 10.1.1 — Operational Dashboard (`src/services/report.service.ts`):**
  - `getOperationalDashboard()`: Upcoming events by date range, low-stock inventory alerts (`currentStock <= minimumStock`), unpaid/overdue invoices count and total amount.
- [ ] **Task 10.1.2 — Event Profitability Report:**
  - `getEventProfitability(eventId)`:
    - **Accrual Perspective:**
      - Invoiced Revenue = $\sum \text{Invoice.totalAmount}$ (excluding CANCELLED).
      - Event Direct Operating Expenses = $\sum \text{Expense.amount}$ (where `scope = EVENT`, `eventId`).
      - Inventory Damaged/Consumed Cost = $\sum (\text{damagedQuantity} \times \text{unitCost})$.
      - Net Accrual Profit = Revenue - Operating Expenses - Damaged Inventory Cost.
    - **Cash Perspective:**
      - Cash Collected = $\sum \text{PaymentAllocation.amount}$.
      - Cash Disbursed = $\sum \text{ExpensePayment.amount}$ (for event's expenses).
      - Net Realized Cash = Cash Collected - Cash Disbursed.
      - Outstanding Client Receivable = Invoiced Revenue - Cash Collected.
- [ ] **Task 10.1.3 — Business Cash Flow & Owner Ledger:**
  - `getBusinessCashFlow(startDate, endDate)`:
    - Total Client Payments Inflow.
    - Total Expense Payments Outflow (Event + Business operating + Inventory purchases).
    - Total Security Deposits Net Outflow (Deposits paid minus refunds).
    - Total Owner Withdrawals Outflow.
    - Net Change in Cash Position.
- [ ] **Task 10.1.4 — Venue Tie-Up & Commission Report:**
  - Total commission payable/paid per venue and per event.
  - Total active refundable security deposit balances held by venues.
- [ ] **Task 10.1.5 — Reports Controller & Routes:**
  - `GET /api/v1/reports/dashboard`
  - `GET /api/v1/reports/event-profitability/:eventId`
  - `GET /api/v1/reports/cash-flow`
  - `GET /api/v1/reports/tie-ups`
  - *Target files:* `backend/src/controllers/report.controller.ts`, `backend/src/routes/report.routes.ts`

---

## 11. Phase 11: Route Composition & Server Assembly

### 11.1 App Router & Server Integration
- [ ] **Task 11.1.1 — Mount all modules in `src/routes/index.ts`:**
  - Mount `/auth` → `authRoutes`
  - Mount `/clients` → `clientRoutes`
  - Mount `/events` → `eventRoutes`
  - Mount `/quotations` → `quotationRoutes`
  - Mount `/invoices` → `invoiceRoutes`
  - Mount `/payments` → `paymentRoutes`
  - Mount `/inventory` → `inventoryRoutes`
  - Mount `/tie-ups` → `tieUpRoutes`
  - Mount `/expenses` → `expenseRoutes`
  - Mount `/withdrawals` → `withdrawalRoutes`
  - Mount `/reports` → `reportRoutes`
  - *Target file:* `backend/src/routes/index.ts`
- [ ] **Task 11.1.2 — Configure Express Middleware in `src/app.ts`:**
  - Verify Helmet security policies, cookie parser, JSON body parser, CORS whitelist.
  - Verify `notFoundHandler` and `errorHandler` are positioned after route registration.
  - *Target file:* `backend/src/app.ts`

---

## 12. Phase 12: Verification, Transaction Testing & Security Hardening

### 12.1 Transaction & Concurrency Verification
- [ ] **Task 12.1.1 — Atomic Transaction Tests:**
  - Verify invoice rollback if an invoice item write fails.
  - Verify payment rollback if payment allocation validation fails.
  - Verify inventory issue rollback if available stock is insufficient.
  - Verify stock non-negativity constraint.
- [ ] **Task 12.1.2 — Security & Ownership Verification:**
  - Verify Client user receives `403 Forbidden` on all Admin-only endpoints.
  - Verify Client user receives `404` or `403` when requesting another client's invoice or event.
  - Verify Client user responses strip internal cost fields, banquet commissions, and profit estimates.
- [ ] **Task 12.1.3 — Decimal Precision Verification:**
  - Verify zero rounding drift across multiple line items and partial payments.

---

## Execution Progress Tracker

| Module / Phase | Status | Assignee | Completion Date |
|---|:---:|:---:|:---:|
| **Phase 1: Foundation & Scripts** | Completed | Backend Lead | 2026-11-10 |
| **Phase 2: Authentication & Guards** | Completed | Backend Lead | 2026-11-10 |
| **Phase 3: Client Management** | Completed | Backend Lead | 2026-11-10 |
| **Phase 4: Event Management & Lifecycle** | Pending | Backend Lead | — |
| **Phase 5: Quotation Management** | Pending | Backend Lead | — |
| **Phase 6: Invoices & Payment Engine** | Pending | Backend Lead | — |
| **Phase 7: Inventory Ledger & Allocations** | Pending | Backend Lead | — |
| **Phase 8: Tie-Ups & Commission Snapshots** | Pending | Backend Lead | — |
| **Phase 9: Expenses & Owner Withdrawals** | Pending | Backend Lead | — |
| **Phase 10: Dashboard & Financial Reports** | Pending | Backend Lead | — |
| **Phase 11: Route Composition** | Pending | Backend Lead | — |
| **Phase 12: Hardening & Testing** | Pending | Backend Lead | — |
