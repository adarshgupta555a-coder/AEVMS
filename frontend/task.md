# Event Management System (EMS) — Frontend Task & Implementation Tracker

**Document Version:** 1.0.0  
**Target:** `frontend/` (Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui Base UI Nova)  
**Parent Blueprint:** [frontend/plan.md](file:///C:/Users/N/Documents/projects/EMS/frontend/plan.md)  
**Scope Status:** Active implementation tasks for all **Completed & Verified Backend Modules**.  
*(Note: Pending backend modules — Inventory Phase 7, Tie-ups Phase 8, Expenses Phase 9, Owner Withdrawals Phase 9, and Reports Phase 10 — are deferred for now as instructed and will be activated once backend endpoints are available).*

---

## Progress Overview

| Phase / Module | Status | Total Tasks | Completed | Pending |
|---|:---:|:---:|:---:|:---:|
| **Phase 1: Foundation, Providers & Centralized API Client** | Completed | 6 | 6 | 0 |
| **Phase 2: Authentication & Portal Activation** | Completed | 5 | 5 | 0 |
| **Phase 3: Shell Layouts & Role-Based Navigation** | Completed | 5 | 5 | 0 |
| **Phase 4: Shared UI Widgets & DataTable Engine** | Completed | 6 | 6 | 0 |
| **Phase 5: Client Management & CRM Module** | Completed | 7 | 7 | 0 |
| **Phase 6: Master Calendar & Operational Activities** | Completed | 5 | 5 | 0 |
| **Phase 7: Quotation Management & Financial Calculation Engine** | Completed | 7 | 7 | 0 |
| **Phase 8: Event Management, Tasks & Day Schedules** | Completed | 7 | 7 | 0 |
| **Phase 9: Invoicing, Tax Engine & PDF Streaming** | Completed | 6 | 6 | 0 |
| **Phase 10: Multi-Invoice Payment Allocation Engine** | Completed | 5 | 5 | 0 |
| **Phase 11: Client Self-Service Portal** | Completed | 6 | 6 | 0 |
| **Phase 12: Production Verification & Build Hardening** | Completed | 4 | 4 | 0 |

---

## Phase 1: Foundation, Providers & Centralized API Client

- [x] **Task 1.1 — Centralized Native Fetch Client (`src/lib/api.ts`):**
  - Implement `apiClient<T>(endpoint, options)` with base URL `http://localhost:8000/api/v1`.
  - Enforce `credentials: "include"` on all requests for HttpOnly cookie transport.
  - Implement automatic 401 retry interceptor: on `401 Unauthorized`, call `POST /api/v1/auth/refresh`, handle token rotation, and replay queued requests.
  - Redirect to `/login?session_expired=true` if refresh token is expired or revoked.
  - Handle binary `application/pdf` responses by returning `Blob`.
  - *Target file:* `frontend/src/lib/api.ts`

- [x] **Task 1.2 — TanStack Query Provider (`src/provider/query-provider.tsx`):**
  - Configure `QueryClient` with standard defaults: `staleTime: 60 * 1000` (1 min), `gcTime: 5 * 60 * 1000` (5 mins), and `retry: 1`.
  - Re-export `QueryClientProvider` and `ReactQueryDevtools` in development mode.
  - *Target file:* `frontend/src/provider/query-provider.tsx`

- [x] **Task 1.3 — Indian Currency & Formatting Utilities (`src/lib/formatters.ts`):**
  - Implement `formatINR(amount)` returning `₹xx,xx,xxx.00` using `Intl.NumberFormat("en-IN")`.
  - Implement Indian phone number formatter and validator regex `^[6-9]\d{9}$`.
  - Implement date helpers: `formatDate(date, "dd MMM yyyy")`, `formatDateTime(date)`, `formatRelativeTime(date)` using `date-fns`.
  - *Target file:* `frontend/src/lib/formatters.ts`

- [x] **Task 1.4 — Global Error Handler & Toast Notifications:**
  - Standardize error extraction from backend `ApiResponse` envelope (`{ error: { code, message, details } }`).
  - Wire Sonner `<Toaster position="top-right" richColors />` in root layout.
  - *Target file:* `frontend/src/lib/utils.ts`

- [x] **Task 1.5 — Shared TypeScript Domain Types (`src/types/models.ts`):**
  - Declare TypeScript interfaces mirroring verified Prisma models: `Client`, `User`, `Event`, `EventTask`, `EventSchedule`, `Quotation`, `QuotationItem`, `Invoice`, `InvoiceItem`, `Payment`, `PaymentAllocation`, `CalendarEntry`.
  - Declare strict string union enums: `UserRole`, `EventStatus`, `QuotationStatus`, `InvoiceStatus`, `InvoiceType`, `PaymentMethod`, `PaymentType`, `DiscountType`, `TaskPriority`, `TaskStatus`, `CalendarEntryType`.
  - *Target file:* `frontend/src/types/models.ts`

- [x] **Task 1.6 — API Response & Pagination Envelope Types (`src/types/api.types.ts`):**
  - Define `ApiResponse<T>`, `PaginationMeta`, `ApiErrorResponse`, `FormFieldError`.
  - *Target file:* `frontend/src/types/api.types.ts`

---

## Phase 2: Authentication & Portal Activation

- [x] **Task 2.1 — Zustand Authentication Store (`src/stores/auth-store.ts`):**
  - Create state: `user: { id, email, name, role, clientId } | null`, `isAuthenticated: boolean`, `isLoading: boolean`.
  - Actions: `setUser`, `clearSession`.
  - *Target file:* `frontend/src/stores/auth-store.ts`

- [x] **Task 2.2 — Authentication Service & Hooks (`src/features/auth/`):**
  - Implement `authService.login(email, password)` → `POST /api/v1/auth/login`.
  - Implement `authService.logout()` → `POST /api/v1/auth/logout`.
  - Implement `authService.getCurrentUser()` → `GET /api/v1/auth/me`.
  - Implement `authService.activatePortal(token, password)` → `POST /api/v1/auth/activate-portal`.
  - Create TanStack Query hook `useCurrentUser()` and mutations `useLoginMutation()`, `useLogoutMutation()`, `useActivatePortalMutation()`.
  - *Target files:* `src/features/auth/services/auth.service.ts`, `src/features/auth/hooks/use-auth.ts`

- [x] **Task 2.3 — Unified Login Page (`src/app/(auth)/login/page.tsx`):**
  - React Hook Form + Zod validation: email format and password min 6 chars.
  - Role-based smart redirection on success:
    - If `user.role === "ADMIN"` → redirect to `/dashboard`.
    - If `user.role === "CLIENT"` → redirect to `/portal/dashboard`.
  - Display session expired alert if query param `?session_expired=true` is present.
  - *Target file:* `frontend/src/app/(auth)/login/page.tsx`

- [x] **Task 2.4 — Client Portal Activation Page (`src/app/activate-portal/page.tsx`):**
  - Public route reading `?token=...` from URL query parameter.
  - Password creation form with confirmation check.
  - Submits to `POST /api/v1/auth/activate-portal`, receives session cookies, and redirects client directly into `/portal/dashboard`.
  - *Target file:* `frontend/src/app/activate-portal/page.tsx`

- [x] **Task 2.5 — Session Restoration Provider (`src/provider/auth-provider.tsx`):**
  - On application mount, execute `useCurrentUser()`.
  - Prevent flashing of unauthenticated states while session is resolving.
  - Protect Admin routes (`/(admin)/*`) and Client routes (`/(client)/*`) against unauthorized roles.
  - *Target file:* `frontend/src/provider/auth-provider.tsx`

---

## Phase 3: Shell Layouts & Role-Based Navigation

- [x] **Task 3.1 — Admin Sidebar Component (`src/components/layout/admin-sidebar.tsx`):**
  - Desktop collapsible sidebar (260px expanded / 68px collapsed) using `components/ui/sidebar.tsx`.
  - Navigation links:
    - Core: Dashboard (`/dashboard`), Calendar (`/calendar`), Clients (`/clients`), Quotations (`/quotations`), Events (`/events`).
    - Finance: Invoices (`/invoices`), Payments (`/payments`).
  - Active route highlighting using `usePathname()`.
  - *Target file:* `frontend/src/components/layout/admin-sidebar.tsx`

- [x] **Task 3.2 — Admin Top Header (`src/components/layout/admin-header.tsx`):**
  - Mobile hamburger trigger activating `Sheet` drawer.
  - Dynamic route breadcrumbs (`Home / Events / EVT-2026-0001`).
  - Global Search button (`Cmd+K` / `Ctrl+K`) triggering Quick Search dialog.
  - Theme mode toggle button (Light / Dark mode).
  - User profile dropdown menu showing user name, role badge, and "Sign Out" action.
  - *Target file:* `frontend/src/components/layout/admin-header.tsx`

- [x] **Task 3.3 — Admin Shell Layout (`src/app/(admin)/layout.tsx`):**
  - Mount Sidebar, Header, Breadcrumbs, and content container.
  - Restrict access to `ADMIN` role.
  - *Target file:* `frontend/src/app/(admin)/layout.tsx`

- [x] **Task 3.4 — Client Portal Header & Shell (`src/app/(client)/layout.tsx`):**
  - Distinct client-facing header showing firm logo and "Client Portal" badge.
  - Horizontal navigation: Dashboard (`/portal/dashboard`), Events (`/portal/events`), Quotations (`/portal/quotations`), Invoices (`/portal/invoices`), Profile (`/portal/profile`).
  - User menu with Client Name and Logout.
  - Restrict access to `CLIENT` role.
  - *Target file:* `frontend/src/app/(client)/layout.tsx`

- [x] **Task 3.5 — Root Home Smart Redirector (`src/app/page.tsx`):**
  - Check active session: if Admin → `/dashboard`; if Client → `/portal/dashboard`; if unauthenticated → `/login`.
  - *Target file:* `frontend/src/app/page.tsx`

---

## Phase 4: Shared UI Widgets & DataTable Engine

- [x] **Task 4.1 — Reusable TanStack Table Component (`src/components/shared/data-table.tsx`):**
  - Headless sorting, filtering, and pagination powered by `@tanstack/react-table` v9.
  - Debounced search input (300ms).
  - Column visibility dropdown menu.
  - Pagination bar: "Previous", "Next", page numbers, and rows-per-page select (10, 20, 50, 100).
  - Loading skeleton rows and Empty state illustration fallback.
  - *Target file:* `frontend/src/components/shared/data-table.tsx`

- [x] **Task 4.2 — Canonical Status Badge (`src/components/shared/status-badge.tsx`):**
  - Mapped colors for all Prisma enums:
    - `EventStatus`: `DRAFT` (zinc), `CONFIRMED` (blue), `PLANNING` (indigo), `IN_PROGRESS` (amber), `COMPLETED` (emerald), `CANCELLED` (rose/strikethrough).
    - `QuotationStatus`: `DRAFT` (zinc), `SENT` (sky), `VIEWED` (purple), `ACCEPTED` (emerald), `REJECTED` (rose), `EXPIRED` (zinc).
    - `InvoiceStatus`: `DRAFT` (zinc), `SENT` (sky), `PARTIALLY_PAID` (amber), `PAID` (emerald), `OVERDUE` (rose font-bold), `CANCELLED` (rose).
  - *Target file:* `frontend/src/components/shared/status-badge.tsx`

- [x] **Task 4.3 — Metric Stat Card (`src/components/shared/stat-card.tsx`):**
  - Card widget with Title, Big Value (`text-2xl font-bold font-mono`), Lucide icon, and optional trend subtext.
  - *Target file:* `frontend/src/components/shared/stat-card.tsx`

- [x] **Task 4.4 — Destructive Confirm Dialog (`src/components/shared/confirm-dialog.tsx`):**
  - Modal with title, description, optional required reason textarea, and async action button.
  - *Target file:* `frontend/src/components/shared/confirm-dialog.tsx`

- [x] **Task 4.5 — Date Range Popover Picker (`src/components/shared/date-range-picker.tsx`):**
  - Calendar picker supporting presets: "Today", "This Week", "This Month", "Last 30 Days", "Custom".
  - *Target file:* `frontend/src/components/shared/date-range-picker.tsx`

- [x] **Task 4.6 — Money Display Component (`src/components/shared/money-display.tsx`):**
  - Clean numeric display with tabular numbers and Indian Rupee styling.
  - *Target file:* `frontend/src/components/shared/money-display.tsx`

---

## Phase 5: Client Management & CRM Module

- [x] **Task 5.1 — Client Validation Schemas (`src/features/clients/schemas/client.schema.ts`):**
  - `createClientSchema`: `name` (min 2), `phone` (regex `^[6-9]\d{9}$`), `email` (optional valid email), `address`, `city`, `notes`.
  - `updateClientSchema`: optional partials.
  - `assignPortalSchema`: `expiresInHours` (default 24).
  - `updateClientStatusSchema`: `isActive` (boolean), `reason` (optional).
  - *Target file:* `frontend/src/features/clients/schemas/client.schema.ts`

- [x] **Task 5.2 — Client Service & TanStack Query Hooks (`src/features/clients/`):**
  - Service methods for `GET /clients`, `POST /clients`, `GET /clients/:id`, `PUT /clients/:id`, `DELETE /clients/:id`.
  - Service methods for `POST /clients/:id/assign-portal`, `GET /clients/:id/portal-status`, `POST /clients/:id/resend-invite`, `PATCH /clients/:id/status`.
  - Service methods for sub-resources: `/events`, `/quotations`, `/invoices`, `/payments`, `/activities`.
  - Query hooks with proper query key factories.
  - *Target files:* `src/features/clients/services/client.service.ts`, `src/features/clients/hooks/use-clients.ts`

- [x] **Task 5.3 — Client Directory View (`src/app/(admin)/clients/page.tsx`):**
  - TanStack Table displaying Name, 10-digit Phone, Email, City, Events Count, Invoices Count, Portal Status.
  - Search input with 300ms debounce.
  - Action button: "+ New Client" opening creation dialog.
  - *Target file:* `frontend/src/app/(admin)/clients/page.tsx`

- [x] **Task 5.4 — Client Creation Modal (`src/features/clients/components/client-create-dialog.tsx`):**
  - React Hook Form + Zod validation with Indian mobile number regex.
  - Server validation 422 error mapping.
  - *Target file:* `frontend/src/features/clients/components/client-create-dialog.tsx`

- [x] **Task 5.5 — Client Detail & Hub Screen (`src/app/(admin)/clients/[id]/page.tsx`):**
  - Client profile header card with contact info and active status toggle (`PATCH /clients/:id/status`).
  - *Target file:* `frontend/src/app/(admin)/clients/[id]/page.tsx`

- [x] **Task 5.6 — Portal Assignment & Management Widget:**
  - Displays state: `NOT_ASSIGNED`, `INVITATION_PENDING`, `INVITATION_EXPIRED`, `ACTIVE`.
  - If `NOT_ASSIGNED`: "Assign Portal Access" button.
  - If `INVITATION_PENDING`: "Copy Activation URL" + "Resend Invitation" button.
  - If `INVITATION_EXPIRED`: Warning banner + "Resend Fresh Invite" button.
  - If `ACTIVE`: Green badge and linked user credentials info.
  - *Target file:* `frontend/src/features/clients/components/client-portal-card.tsx`

- [x] **Task 5.7 — Client Sub-Resource Tabs (Events, Quotations, Invoices, CRM Activities):**
  - Tab 1: Client's Events table.
  - Tab 2: Client's Quotations table.
  - Tab 3: Client's Invoices table.
  - Tab 4: Client's Payment receipts.
  - Tab 5: CRM Activity Timeline (`CalendarEntry` feed) + "Log Activity" button.
  - *Target file:* `frontend/src/features/clients/components/client-tabs.tsx`

---

## Phase 6: Master Calendar & Operational Activities

- [x] **Task 6.1 — Calendar Validation Schemas (`src/features/calendar/schemas/calendar.schema.ts`):**
  - Schema: `title`, `description`, `type` (`MEETING`, `SITE_VISIT`, `VENDOR_MEETING`, `OFFICE_ACTIVITY`, `OTHER`), `startAt`, `endAt`, `allDay`, `location`, `clientId`, `eventId`.
  - Date sanity validation: `endAt >= startAt`.
  - *Target file:* `frontend/src/features/calendar/schemas/calendar.schema.ts`

- [x] **Task 6.2 — Calendar Service & Hooks (`src/features/calendar/`):**
  - Endpoints: `GET /calendar`, `POST /calendar`, `GET /calendar/:id`, `PUT /calendar/:id`, `DELETE /calendar/:id`.
  - TanStack Query hooks for entries and mutations.
  - *Target files:* `src/features/calendar/services/calendar.service.ts`, `src/features/calendar/hooks/use-calendar.ts`

- [x] **Task 6.3 — Master Calendar Screen (`src/app/(admin)/calendar/page.tsx`):**
  - Month, week, and day grid views.
  - Color-coded entry badges based on `type`.
  - Quick filter by entry type and search keyword.
  - *Target file:* `frontend/src/app/(admin)/calendar/page.tsx`

- [x] **Task 6.4 — Activity Creation Drawer / Dialog:**
  - Form linking activity to an existing Client and an optional Event.
  - Date and time pickers with validation.
  - *Target file:* `frontend/src/features/calendar/components/activity-dialog.tsx`

- [x] **Task 6.5 — Activity Detail & Quick Actions Modal:**
  - View details, edit times, or delete entry with confirmation.
  - *Target file:* `frontend/src/features/calendar/components/activity-detail-dialog.tsx`

---

## Phase 7: Quotation Management & Financial Calculation Engine

- [x] **Task 7.1 — Quotation Schemas (`src/features/quotations/schemas/quotation.schema.ts`):**
  - Schema for item: `itemName`, `description`, `quantity` (positive number), `unit`, `unitPrice` (>= 0), `sortOrder`.
  - Schema for quotation: `clientId`, `title`, `eventType`, `eventDate`, `venue`, `guestCount`, `discountType` (`PERCENTAGE`/`FIXED`), `discountValue`, `taxRate`, `validUntil`, `notes`, `terms`, `items` (min 1).
  - *Target file:* `frontend/src/features/quotations/schemas/quotation.schema.ts`

- [x] **Task 7.2 — Live Mathematical Calculation Engine (`src/features/quotations/utils/math.ts`):**
  - Implement zero-drift decimal math:
    - Line item total: $\text{Quantity} \times \text{UnitPrice}$
    - Subtotal: $\sum \text{Line Item Totals}$
    - Discount Amount: Fixed or Percentage
    - Amount After Discount: $\text{Subtotal} - \text{Discount Amount}$
    - Tax (GST): Percentage applied to amount after discount
    - Grand Total: $(\text{Subtotal} - \text{Discount}) + \text{Tax Amount}$.
  - *Target file:* `frontend/src/features/quotations/utils/math.ts`

- [x] **Task 7.3 — Quotation Service & Hooks (`src/features/quotations/`):**
  - Endpoints: `GET /quotations`, `POST /quotations`, `GET /quotations/:id`, `PUT /quotations/:id`, `PATCH /quotations/:id/status`, `POST /quotations/:id/convert-to-event`, `DELETE /quotations/:id`.
  - *Target files:* `src/features/quotations/services/quotation.service.ts`, `src/features/quotations/hooks/use-quotations.ts`

- [x] **Task 7.4 — Quotation Directory View (`src/app/(admin)/quotations/page.tsx`):**
  - TanStack Table displaying Quotation Number (`QUO-YYYY-XXXX`), Client Name, Event Type, Total Amount (₹), Status Badge, and Date.
  - Filter by status (`DRAFT`, `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`).
  - Action button: "+ Create Quotation".
  - *Target file:* `frontend/src/app/(admin)/quotations/page.tsx`

- [x] **Task 7.5 — Dynamic Line Item Builder Screen (`src/app/(admin)/quotations/new/page.tsx`):**
  - Client searchable combobox.
  - Dynamic line item table: Add row, Remove row, Reorder rows.
  - Real-time calculation summary card displaying Subtotal, Discount, GST Tax, and Total Amount.
  - *Target file:* `frontend/src/app/(admin)/quotations/new/page.tsx`

- [x] **Task 7.6 — Quotation Detail View (`src/app/(admin)/quotations/[id]/page.tsx`):**
  - Status progression actions: "Send to Client" (`DRAFT` → `SENT`), "Cancel".
  - Status display: shows `VIEWED` tag once client opens in portal.
  - Edit quotation (enabled when status is not `ACCEPTED` or `CANCELLED`).
  - *Target file:* `frontend/src/app/(admin)/quotations/[id]/page.tsx`

- [x] **Task 7.7 — One-Click Event Conversion Dialog:**
  - Active when quotation status is `ACCEPTED`.
  - Opens pre-filled dialog with event title, client, date, venue, and quotation budget.
  - Submits to `POST /api/v1/quotations/:id/convert-to-event`.
  - Redirects Admin to newly created event.
  - *Target file:* `frontend/src/features/quotations/components/convert-to-event-dialog.tsx`

---

## Phase 8: Event Management, Tasks & Day Schedules

- [x] **Task 8.1 — Event Validation Schemas (`src/features/events/schemas/event.schema.ts`):**
  - Schema: `clientId`, `quotationId` (optional), `title`, `eventType`, `description`, `eventDate`, `startTime`, `endTime`, `venueName`, `venueAddress`, `guestCount`, `budget`, `notes`.
  - Time validation: `endTime >= startTime`.
  - Status schema: `status` (`DRAFT`, `CONFIRMED`, `PLANNING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), `reason`.
  - Operational schemas: `createEventTaskSchema`, `createEventScheduleSchema`.
  - *Target file:* `frontend/src/features/events/schemas/event.schema.ts`

- [x] **Task 8.2 — Event Service & Hooks (`src/features/events/`):**
  - Endpoints: `GET /events`, `POST /events`, `GET /events/:id`, `PUT /events/:id`, `PATCH /events/:id/status`, `DELETE /events/:id`, `GET /events/:id/summary`.
  - Task endpoints: `GET /events/:id/tasks`, `POST /events/:id/tasks`, `PUT /events/tasks/:taskId`, `DELETE /events/tasks/:taskId`.
  - Schedule endpoints: `GET /events/:id/schedules`, `POST /events/:id/schedules`, `PUT /events/schedules/:scheduleId`, `DELETE /events/schedules/:scheduleId`.
  - *Target files:* `src/features/events/services/event.service.ts`, `src/features/events/hooks/use-events.ts`

- [x] **Task 8.3 — Event Directory View (`src/app/(admin)/events/page.tsx`):**
  - TanStack Table displaying Event Number (`EVT-YYYY-XXXX`), Title, Client, Event Date, Status Badge, Planned Budget.
  - Filters by Status and Date range.
  - Action button: "+ Create Event".
  - *Target file:* `frontend/src/app/(admin)/events/page.tsx`

- [x] **Task 8.4 — Event Creation Screen (`src/app/(admin)/events/new/page.tsx`):**
  - Client selection, date/time pickers, venue details, guest count, and initial budget.
  - *Target file:* `frontend/src/app/(admin)/events/new/page.tsx`

- [x] **Task 8.5 — Event Operations Command Center (`src/app/(admin)/events/[id]/page.tsx`):**
  - Header: Event Number, Title, Client, Event Date, Venue Name.
  - Visual State Machine Breadcrumb Stepper:
    `DRAFT` ➔ `CONFIRMED` ➔ `PLANNING` ➔ `IN_PROGRESS` ➔ `COMPLETED`.
  - Status transition dropdown enforcing allowed transitions.
  - "Cancel Event" button with required cancellation reason prompt.
  - *Target file:* `frontend/src/app/(admin)/events/[id]/page.tsx`

- [x] **Task 8.6 — Event Financial Summary Banner (Admin Only):**
  - Connect to `GET /api/v1/events/:id/summary`.
  - Displays: Planned Budget, Total Invoiced, Total Paid Cash, Total Expenses, Balance Receivable, Net Profit Margin.
  - *Target file:* `frontend/src/features/events/components/event-financial-summary.tsx`

- [x] **Task 8.7 — Operational Sub-Modules Tabs (Tasks & Itinerary Schedule):**
  - **Task Checklist Tab:** Tasks grouped by status (`TODO`, `IN_PROGRESS`, `COMPLETED`), priority tags (`URGENT`, `HIGH`, `MEDIUM`, `LOW`), due dates, and add/edit modal.
  - **Event Itinerary Tab:** Chronological timeline schedule blocks (`startAt`, `endAt`, title) with add/edit modal.
  - *Target files:* `src/features/events/components/event-tasks-tab.tsx`, `src/features/events/components/event-schedules-tab.tsx`

---

## Phase 9: Invoicing, Tax Engine & PDF Streaming

- [x] **Task 9.1 — Invoice Validation Schemas (`src/features/invoices/schemas/invoice.schema.ts`):**
  - Line Item schema: `itemName`, `description`, `quantity`, `unit`, `unitPrice`, `type` (`PROFORMA` vs `FINAL`), `quotationId`, `advanceAdjusted`.
  - Invoice schema: `clientId`, `eventId`, `title`, `invoiceDate`, `dueDate`, `discountType`, `discountValue`, `taxRate`, `notes`, `terms`, `items` (min 1).
  - Validation: `dueDate >= invoiceDate`.
  - *Target file:* `frontend/src/features/invoices/schemas/invoice.schema.ts`

- [x] **Task 9.2 — Invoice Service & Hooks (`src/features/invoices/`):**
  - Endpoints: `GET /invoices`, `POST /invoices`, `GET /invoices/:id`, `GET /invoices/:id/balance`, `GET /invoices/:id/pdf`, `PUT /invoices/:id`, `PATCH /invoices/:id/status`, `DELETE /invoices/:id`.
  - Streaming PDF download hook: fetches blob, creates object URL, triggers browser download of `INV-YYYY-XXXX.pdf`.
  - *Target files:* `src/features/invoices/services/invoice.service.ts`, `src/features/invoices/hooks/use-invoices.ts`

- [x] **Task 9.3 — Invoice Directory View (`src/app/(admin)/invoices/page.tsx`):**
  - TanStack Table displaying Invoice Number (`INV-YYYY-XXXX`), Client, Event, Total Amount (₹), Paid Amount (₹), Balance Amount (₹), Status Badge, Due Date.
  - Filters by Status (`DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`).
  - Action button: "+ Create Invoice".
  - Row quick action: "Download PDF" icon button.
  - *Target file:* `frontend/src/app/(admin)/invoices/page.tsx`

- [x] **Task 9.4 — Itemized Invoice Creation Screen (`src/app/(admin)/invoices/new/page.tsx`):**
  - Client and Event selectors.
  - Issue date and Due date pickers.
  - Line items table with PROFORMA vs FINAL toggle and advance adjusted input.
  - Real-time tax and subtotal calculations.
  - *Target file:* `frontend/src/app/(admin)/invoices/new/page.tsx`

- [x] **Task 9.5 — Invoice Detail View (`src/app/(admin)/invoices/[id]/page.tsx`):**
  - Itemized line charges breakdown.
  - Live Balance Card: Total Amount, Paid Amount, Balance Receivable.
  - Payment Allocation History table: lists payments contributing to this invoice with receipt numbers and allocated amounts.
  - Status transition dropdown (`DRAFT` → `SENT`, `OVERDUE`, `CANCELLED`).
  - *Target file:* `frontend/src/app/(admin)/invoices/[id]/page.tsx`

- [x] **Task 9.6 — Invoice PDF Streaming & Preview Modal:**
  - "Download PDF" button triggers streaming download.
  - Inline modal preview rendering PDF in embedded iframe.
  - *Target file:* `frontend/src/features/invoices/components/invoice-pdf-modal.tsx`

---

## Phase 10: Multi-Invoice Payment Allocation Engine

- [x] **Task 10.1 — Payment Validation Schemas (`src/features/payments/schemas/payment.schema.ts`):**
  - Allocation schema: `invoiceId`, `amount` (> 0).
  - Payment schema: `clientId`, `eventId` (optional), `proformaInvoiceId` (optional), `amount` (> 0), `paymentType` (`ADVANCE`, `PARTIAL`, `FULL`, `OTHER`), `paymentMethod` (`CASH`, `UPI`, `BANK_TRANSFER`, `CARD`, `CHEQUE`, `OTHER`), `paymentDate`, `transactionReference`, `notes`, `allocations` array.
  - *Target file:* `frontend/src/features/payments/schemas/payment.schema.ts`

- [x] **Task 10.2 — Payment Service & Hooks (`src/features/payments/`):**
  - Endpoints: `GET /payments`, `POST /payments`, `GET /payments/:id`, `DELETE /payments/:id`.
  - Query hooks and mutation for recording payment.
  - *Target files:* `src/features/payments/services/payment.service.ts`, `src/features/payments/hooks/use-payments.ts`

- [x] **Task 10.3 — Payment Directory View (`src/app/(admin)/payments/page.tsx`):**
  - TanStack Table displaying Payment Number (`PAY-YYYY-XXXX`), Client, Event, Amount (₹), Method Badge, Payment Date, Reference Number.
  - Action button: "+ Record Payment".
  - *Target file:* `frontend/src/app/(admin)/payments/page.tsx`

- [x] **Task 10.4 — Multi-Invoice Payment Allocation Wizard (`src/app/(admin)/payments/new/page.tsx`):**
  - Step 1: Select Client → fetches all unpaid and partially paid invoices for this client.
  - Step 2: Payment Details (Total Amount, Date, Method, Type, Reference Number).
  - Step 3: Multi-row allocation table. Admin enters amount to apply to each pending invoice.
  - Strict Client-Side Guardrails:
    - $\sum \text{Allocated Amounts} \le \text{Payment Total Amount}$
    - For each invoice: $\text{Allocated Amount} \le \text{Invoice Remaining Balance}$.
    - Live indicator shows "Remaining Unallocated: ₹...".
  - *Target file:* `frontend/src/app/(admin)/payments/new/page.tsx`

- [x] **Task 10.5 — Payment Detail & Receipt View (`src/app/(admin)/payments/[id]/page.tsx`):**
  - Displays payment details and receipt card.
  - Table of affected invoices with allocated amounts.
  - "Delete Payment" button with confirmation: warns that allocations will be rolled back and affected invoice statuses recalculated.
  - *Target file:* `frontend/src/app/(admin)/payments/[id]/page.tsx`

---

## Phase 11: Client Self-Service Portal

- [x] **Task 11.1 — Client Portal Dashboard (`src/app/(client)/portal/dashboard/page.tsx`):**
  - Welcome Banner with client name.
  - Countdown card for next upcoming event.
  - Pending Invoices alert card with total outstanding balance.
  - Quotations awaiting approval badge.
  - *Target file:* `frontend/src/app/(client)/portal/dashboard/page.tsx`

- [x] **Task 11.2 — Client Events View (`src/app/(client)/portal/events/page.tsx` and `[id]/page.tsx`):**
  - List and detail view for client's own events (`where: { clientId: user.clientId }`).
  - View event dates, venue, and day-of-event itinerary schedules.
  - Security Guarantee: internal vendor purchase costs, company expenses, and profit margins are completely stripped.
  - *Target files:* `src/app/(client)/portal/events/page.tsx`, `src/app/(client)/portal/events/[id]/page.tsx`

- [x] **Task 11.3 — Client Quotations Review Screen (`src/app/(client)/portal/quotations/page.tsx` and `[id]/page.tsx`):**
  - Displays quotations with line items, quantities, and totals.
  - Real-time CRM Hook: opening quotation auto-marks status as `VIEWED` if it was `SENT`.
  - Client Decision Actions:
    - "Accept Quotation" (Green button): opens confirmation modal and sets status to `ACCEPTED`.
    - "Reject Quotation" (Red button): opens modal with optional feedback textarea and sets status to `REJECTED`.
  - *Target files:* `src/app/(client)/portal/quotations/page.tsx`, `src/app/(client)/portal/quotations/[id]/page.tsx`

- [x] **Task 11.4 — Client Invoices & Receipts View (`src/app/(client)/portal/invoices/page.tsx` and `[id]/page.tsx`):**
  - List of invoices with status badges, due dates, paid amount, and remaining balance.
  - "Download PDF" button: triggers streaming download of `INV-YYYY-XXXX.pdf` directly.
  - *Target files:* `src/app/(client)/portal/invoices/page.tsx`, `src/app/(client)/portal/invoices/[id]/page.tsx`

- [x] **Task 11.5 — Client Profile Screen (`src/app/(client)/portal/profile/page.tsx`):**
  - Displays client name, registered phone, email, and address.
  - *Target file:* `frontend/src/app/(client)/portal/profile/page.tsx`

- [x] **Task 11.6 — Client Portal Route Guards:**
  - Server-authoritative IDOR guard: clients requesting unauthorized records receive 403 / 404.
  - Redirect non-client sessions to `/login`.
  - *Target file:* `frontend/src/provider/auth-provider.tsx`

---

## Phase 12: Production Verification & Build Hardening

- [x] **Task 12.1 — ESLint & Type Check:**
  - Run `npm run lint` and verify 0 warnings / 0 errors.
  - Run `npm run build` and verify all static routes compile cleanly with Turbopack.
- [x] **Task 12.2 — Cross-Role Access Audit:**
  - Verify Client user cannot access `/dashboard`, `/clients`, `/events/new`, `/quotations/new`, `/invoices/new`, or `/payments/new`.
  - Verify Admin user can seamlessly access all management consoles.
- [x] **Task 12.3 — Theme Contrast & Token Audit:**
  - Verify all text, badges, borders, and focus rings meet WCAG 2.1 AA in both Light and Dark modes.
- [x] **Task 12.4 — Mobile Responsiveness Test:**
  - Verify responsive sidebar drawer (`Sheet`), data tables with horizontal scroll, and touch-friendly buttons on mobile viewports.
