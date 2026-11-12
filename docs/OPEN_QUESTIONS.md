# Event Management System (EMS) — Open Decisions & Questions Register

**Document Version:** 1.0.0  
**Status:** Under Review / Awaiting Business Sign-off  
**Context:** EMS for small event-management business in India (INR ₹)  
**Parent Document:** [LLD.md](file:///C:/Users/N/Documents/projects/EMS/docs/LLD.md)  

---

## 1. Introduction

This register captures every unresolved architectural, financial, and product decision identified in [plan.md](file:///C:/Users/N/Documents/projects/EMS/plan.md) and during the technical audit of the EMS codebase.

For each item, this document details:
- **Decision summary and background**
- **Viable options** with engineering and business trade-offs
- **Recommended option** for initial release (Release 1.0)
- **Downstream modules affected** and technical impact

In accordance with system design principles, unresolved decisions must remain explicitly marked as **Open decision** and should not be unilaterally decided as hardcoded assumptions in code without client sign-off.

---

## 2. Decision Register

### Decision 1: Client Identity & Account Representation
- **Status:** Resolved / Confirmed by Schema Audit (with design clarification)
- **Question:** Is a Client represented directly by `User`, or is there a separate `Client` profile/model?
- **Analysis & Existing Reality:**
  - Inspection of `prisma/schema.prisma` confirms both `User` and `Client` models exist.
  - `User` has `clientId String? @unique` with relation `client Client? @relation(fields: [clientId], references: [id])`.
  - `Client` has `user User?`.
- **Options:**
  - *Option A (Recommended):* Hybrid 1:1 Identity Profile. `Client` represents the business entity/customer record (name, phone, address, quotations, events, invoices). `User` represents login credentials (email, passwordHash, role, refreshTokens). A client can exist in the system (e.g., walk-in customer) without a web login (`clientId` without a `User`). When given portal access, a `User` account is linked via `clientId`.
  - *Option B:* Merge `Client` into `User`. Requires dropping `Client` model, migrating relations, and forcing every client to have unique credentials.
- **Trade-offs:** Option A preserves existing schema and database migrations without destructive changes. It allows recording events and invoices for clients who do not require portal logins.
- **Recommendation:** **Adopt Option A.** Maintain `Client` as the business entity and `User` as the authentication principal. Admin users have `role = ADMIN` and `clientId = null`. Client users have `role = CLIENT` and a non-null `clientId`.
- **Affected Modules:** Auth, Clients, User Management, Access Control Middleware.

---

### Decision 2: Client Account Creation & Registration
- **Status:** Open decision
- **Question:** Can clients self-register via a public sign-up page, or are accounts strictly created/invited by Admin?
- **Options:**
  - *Option A (Recommended):* **Admin-managed invitation/creation only.** Admin creates the `Client` profile. If the client needs portal access, Admin enters their email and triggers an account invite (or sets an initial temporary password).
  - *Option B:* **Public self-registration.** Anyone can register as a Client.
- **Trade-offs:** 
  - Option A matches the business reality of a boutique event management firm in India, where engagements begin with offline inquiries, consultations, or phone calls. Public registration introduces spam, orphaned client records, and security overhead (captcha, email verification services).
  - Option B creates duplicate clients if a walk-in client later registers online with a different phone or email.
- **Recommendation:** **Option A (Admin invitation only).** Public self-registration is out of scope for Release 1.0.
- **Affected Modules:** Auth module (`/api/v1/auth/register` omitted or restricted to Admin invite), Client UI.

---

### Decision 3: Authentication Mechanism & Password Management
- **Status:** Open decision
- **Question:** What is the session/token architecture and password reset strategy?
- **Options:**
  - *Option A (Recommended):* **JWT Dual-Token with HttpOnly Secure Cookies.** Short-lived Access Token (15 mins) and long-lived Refresh Token (7 days) stored in database (`RefreshToken` model with hash). Access and refresh tokens delivered via `httpOnly`, `secure`, `sameSite: 'lax'` cookies. Password reset via Admin-generated one-time token or direct Admin password reset.
  - *Option B:* **Bearer Tokens in Authorization Header (localStorage).** Easy to implement for mobile/SPA, but vulnerable to XSS and token exfiltration.
  - *Option C:* **Third-party Auth (Supabase Auth / NextAuth / Auth0).** Delegates auth to external provider, but diverges from existing `User` and `RefreshToken` Prisma schema and migrations.
- **Trade-offs:** Option A aligns exactly with the existing `RefreshToken` model in `schema.prisma` and provides robust XSS and token revocation defense.
- **Recommendation:** **Option A.** Implement JWT dual-token using HttpOnly cookies. Initial password reset flow will be Admin-assisted (Admin resets password or generates a temporary password) until third-party transactional email (Resend / AWS SES) is configured.
- **Affected Modules:** Auth middleware, `/api/v1/auth/*`, Frontend API client.

---

### Decision 4: Event Lifecycle & Status Transitions
- **Status:** Open decision
- **Question:** What are the exact event statuses, allowable state transitions, and cancellation/rescheduling rules?
- **Analysis:** Schema defines `enum EventStatus { DRAFT, CONFIRMED, PLANNING, IN_PROGRESS, COMPLETED, CANCELLED }`.
- **Options:**
  - *Option A (Recommended - Strict State Machine):*
    - `DRAFT` → `CONFIRMED` (upon initial agreement/proforma advance)
    - `CONFIRMED` → `PLANNING` (schedule and inventory allocated)
    - `PLANNING` → `IN_PROGRESS` (event day / execution active)
    - `IN_PROGRESS` → `COMPLETED` (event concluded, pending final settlement)
    - Any state except `COMPLETED` → `CANCELLED`
    - Cancellation rule: Cancellation does not delete historical expenses or received payments; it blocks new inventory issues and triggers deposit/refund review.
  - *Option B (Free Transition):* Allow Admin to toggle any status at any time without validation.
- **Trade-offs:** Option A prevents erratic states (e.g., marking a DRAFT event as COMPLETED without dates or invoices) and protects financial audit integrity.
- **Recommendation:** **Option A.** Implement strict transition validation in `EventService`.
- **Affected Modules:** Events Module, Inventory Allocation, Invoice generation.

---

### Decision 5: Invoice Numbering, GST/Tax, and Billing Models
- **Status:** Open decision
- **Question:** How should invoice numbers be formatted? Is GST statutory computation mandatory? Are discounts and line-item advances supported?
- **Analysis:** Schema already contains:
  - `subtotal`, `discountType` (`PERCENTAGE`/`FIXED`), `discountValue`, `taxRate`, `taxAmount`, `totalAmount`.
  - `InvoiceItem` has `quantity`, `unitPrice`, `totalPrice`, `advanceAdjusted`, and `type` (`PROFORMA`/`FINAL`).
  - `PaymentAllocation` allows partial allocation to specific invoices.
- **Options:**
  - *Option A (Recommended):*
    - **Numbering:** Auto-generated sequential format: `INV-YYYY-XXXX` (e.g., `INV-2026-0001`) with transactional sequence locking.
    - **Taxation:** Simple flat GST percentage input (e.g., 0%, 5%, 12%, 18%) applied at invoice level: `taxAmount = (subtotal - discount) * (taxRate / 100)`. Statutory CGST/SGST/IGST splitting deferred to accounting exports.
    - **Advances:** Proforma invoices collect advance payments via `Payment.proformaInvoiceId`. When the final invoice is issued, advances are linked via `PaymentAllocation` or `advanceAdjusted`.
    - **Overpayment:** Blocked by default. Total allocated payments cannot exceed `Invoice.totalAmount`.
  - *Option B:* Complex statutory multi-state GST engine with HSN/SAC codes, reverse charge, and separate CGST/SGST/IGST columns per line item.
- **Trade-offs:** Option B is explicitly out of scope per `plan.md` Section 1.2 ("Not a complex accounting/ERP replacement, GST filing, or statutory accounting engine"). Option A satisfies operational billing while preserving full compatibility with the existing schema.
- **Recommendation:** **Option A.**
- **Affected Modules:** Invoice Service, Payment Service, Client Billing UI.

---

### Decision 6: Commission Calculation Base & Dual Rules
- **Status:** Open decision
- **Question:** What is the authoritative base amount for tie-up commissions? Can fixed and percentage commissions coexist for the same event?
- **Analysis:** Schema `TieUpEvent` contains:
  - `commissionType CommissionType` (`FIXED` or `PERCENTAGE`)
  - `commissionValue Decimal`
  - `commissionBaseAmount Decimal?`
  - `commissionAmount Decimal` (Required)
- **Options:**
  - *Option A (Recommended):* Mutually exclusive per `TieUpEvent`. If `FIXED`, `commissionAmount = commissionValue` (e.g., ₹5,000 flat). If `PERCENTAGE`, Admin specifies `commissionBaseAmount` (e.g., agreed venue rental ₹1,00,000 or client invoice ₹1,50,000) and `commissionAmount = commissionBaseAmount * (commissionValue / 100)`.
  - *Option B:* Allow hybrid (Fixed + Percentage) simultaneously.
  - *Option C:* Automatically link `commissionBaseAmount` strictly to `Invoice.subtotal` or `Event.budget`.
- **Trade-offs:** Tying commission strictly to `Event.budget` is dangerous because budget is a planning estimate, not an agreed venue price. Tying strictly to client invoice is often inaccurate because the banquet hall commission may be negotiated solely on catering/hall hire, not on decoration or sound equipment. Option A allows explicit base selection while enforcing snapshot persistence.
- **Recommendation:** **Option A.** The base amount is explicitly selected/confirmed by Admin during event tie-up linking and snapshotted.
- **Affected Modules:** Tie-up Service, Event Expense Service.

---

### Decision 7: Canonical Commission Bookkeeping Flow
- **Status:** Open decision
- **Question:** How is commission recorded to prevent double-counting between `TieUpTransaction` and `Expense`?
- **Analysis:**
  - In `schema.prisma`, `Expense` has `tieUpEventId String?` and category `BANQUET_COMMISSION`.
  - `TieUpTransaction` has `transactionType` which includes `COMMISSION_RECEIVED` and `OTHER_EXPENSE`.
  - In event management, banquet commission can be **paid by the business to the venue** (referral/brokerage cost) OR **received by the business from the venue** (kickback/commission on client booking).
- **Options:**
  - *Option A (Recommended - Canonical Separation):*
    - **Commission as Expense (Business pays partner):** Stored in `Expense` with `scope = EVENT`, `category = BANQUET_COMMISSION`, and `tieUpEventId = <id>`. Payments against this are logged in `ExpensePayment`. Does NOT create a conflicting `TieUpTransaction`.
    - **Commission as Inflow (Partner pays business kickback):** Logged in `TieUpTransaction` with `transactionType = COMMISSION_RECEIVED`.
    - **Deposit movements:** Stored exclusively in `TieUpTransaction` (`SECURITY_DEPOSIT_PAID`, `SECURITY_DEPOSIT_REFUNDED`).
  - *Option B:* Synchronize every commission expense as a shadow `TieUpTransaction`.
- **Trade-offs:** Option B leads to double-counting in ledger queries unless complex exclusion filters are maintained. Option A provides single-source-of-truth semantics.
- **Recommendation:** **Option A.** Clearly delineate expense outflow vs collaboration inflow.
- **Affected Modules:** Expenses, Tie-ups, Reports & Financial Rollups.

---

### Decision 8: Refundable Security Deposit Lifecycle & Settlement
- **Status:** Open decision
- **Question:** Are security deposits held per partner or per event? How are forfeitures and refunds handled?
- **Analysis:** Schema `TieUp` has `securityDeposit Decimal @default(0)`. `TieUpTransaction` links to `tieUpId` with optional `tieUpEventId`.
- **Options:**
  - *Option A (Recommended):* **Partner-level master deposit with event correlation.** The business places a rolling or initial deposit with the venue (e.g., ₹25,000 standing deposit). When an event occurs, damages or specific deductions can be recorded via `TieUpTransaction` referencing `tieUpEventId`. Outstanding deposit is a balance sheet asset, not an expense.
  - *Option B:* Enforce that every single event must have an isolated deposit paid and refunded.
- **Trade-offs:** In India, small event planners often maintain either an annual/standing deposit with preferred venues or pay per major event. Supporting partner-level ledger with optional event tagging accommodates both patterns without schema changes.
- **Recommendation:** **Option A.** Standing/event deposits managed through `TieUpTransaction`.
- **Affected Modules:** Tie-ups, Financial Reports.

---

### Decision 9: Inventory Valuation & Consumption Costing Policy
- **Status:** Open decision
- **Question:** What costing model should determine event inventory consumption cost (FIFO, Weighted Average, or Purchase Cost allocation)?
- **Analysis:**
  - Schema distinguishes `itemType`: `REUSABLE` (furniture, sound, lights) vs `CONSUMABLE` (wristbands, fresh flowers, disposable decor).
  - `InventoryItem` has `purchasePrice Decimal?` and `currentStock`.
  - `EventInventory` tracks `issuedQuantity`, `returnedQuantity`, `damagedQuantity`.
- **Options:**
  - *Option A (Recommended - Reusable Depreciation + Consumable Standard Cost):*
    - **Reusable Items:** No direct consumption cost deducted from event profit if returned undamaged. If damaged/lost, replacement cost (`damagedQuantity * unitCost`) is charged as an event loss cost.
    - **Consumable Items:** Fully consumed items are charged at `issuedQuantity * unitCost` (using current purchasePrice or average cost).
    - **Purchase of stock:** Kept as capital asset outflow (`ExpenseCategory.INVENTORY_PURCHASE`), never deducted directly from event operating profit.
  - *Option B (Full FIFO/LIFO tracking):* Requires complex lot-based batch tracking tables (`InventoryBatch`, `BatchAllocation`) not present in the current schema.
- **Trade-offs:** Option B requires substantial schema alterations and complex operational input from a small 2–7 person business. Option A fits the existing schema perfectly and provides 100% accurate profit isolation between stock investment and event consumption.
- **Recommendation:** **Option A.**
- **Affected Modules:** Inventory Service, Financial Reports.

---

### Decision 10: Inventory Purchase Expense Reconciliation
- **Status:** Open decision
- **Question:** Can a single inventory purchase expense link to multiple inventory movements?
- **Analysis:** In `schema.prisma`, `InventoryMovement.expenseId` is a foreign key to `Expense.id`, establishing a 1-to-many relationship: One `Expense` can have many `InventoryMovement` records (`inventoryMovements InventoryMovement[]`).
- **Options:**
  - *Option A (Recommended):* Allow one `Expense` of category `INVENTORY_PURCHASE` to link to one or more `InventoryMovement` entries (e.g., bill of ₹50,000 covering 10 chairs and 5 tables). Movement type must be `PURCHASE`.
  - *Option B:* Strict 1-to-1 linkage only.
- **Trade-offs:** Option A matches vendor purchasing realities (one vendor invoice covers multiple item categories).
- **Recommendation:** **Option A.** Transactionally create the `Expense` and all associated `PURCHASE` movements in a single Prisma transaction.
- **Affected Modules:** Inventory Service, Expense Service.

---

### Decision 11: Profit Calculation & Financial Reporting Basis
- **Status:** Open decision
- **Question:** Should event profit and business net margins be reported on a Cash Basis (money in vs money out) or Accrual/Earned Basis (invoiced revenue vs incurred costs)?
- **Options:**
  - *Option A (Recommended - Dual Perspective Reporting):*
    - **Accrual Event Operational Margin:** `Total Invoiced Amount - Event Operating Expenses (Transport + Commission + Direct Costs) - Damaged/Consumed Inventory Cost`.
    - **Cash Realized Margin:** `Total Payments Received - Event Expense Payments Paid`.
    - Clearly separate the two views on the dashboard.
  - *Option B:* Single strict cash-only report.
- **Trade-offs:** Small businesses need both: Accrual tells them if the event contract was profitable, while Cash tells them whether they have collected enough money to pay suppliers and avoid cash-flow crunches.
- **Recommendation:** **Option A.** Label metrics transparently on reports (`Accrual/Contract Profit` vs `Cash Flow Profit`).
- **Affected Modules:** Reports Service, Dashboard UI.

---

### Decision 12: File & Receipt Storage Provider
- **Status:** Open decision
- **Question:** Where are receipt images and document attachments stored?
- **Analysis:** `Expense.receiptUrl` exists as a string field.
- **Options:**
  - *Option A (Recommended):* **Supabase Storage (S3-compatible).** Since the database is already hosted on Supabase PostgreSQL, Supabase Storage buckets (private buckets with time-limited signed URLs) provide zero-extra-infrastructure integration.
  - *Option B:* Local server disk storage (`/uploads`). Fragile, loses files across VM recreations or stateless deploys.
  - *Option C:* AWS S3 / Cloudflare R2. Requires separate accounts and credentials.
- **Trade-offs:** Option A leverages the existing Supabase relationship without adding an additional cloud vendor.
- **Recommendation:** **Option A (Supabase Storage).** Local fallback during development.
- **Affected Modules:** Expense attachment uploads, Client documents.

---

### Decision 13: Notification & Messaging Channels
- **Status:** Deferred / Post-1.0
- **Question:** Should automated WhatsApp/SMS/Email notifications be built for payment receipts and upcoming events?
- **Recommendation:** **Deferred.** Out of scope for initial release per `plan.md` Section 15 item 13. System will generate standard in-app data and printable/PDF invoice views first.
- **Affected Modules:** None in Release 1.0.

---

### Decision 14: Audit Trail Granularity
- **Status:** Open decision
- **Question:** Which operations require dedicated immutable audit logs vs standard `createdAt`/`updatedAt`/`recordedById` tracking?
- **Options:**
  - *Option A (Recommended):* Utilize existing relational audit columns (`createdById`, `recordedById`, `createdAt`, `updatedAt`, `InventoryMovement` ledger, `TieUpTransaction` ledger). Deletions of financial records (Invoices, Payments, Expenses) are disallowed or soft-marked (`CANCELLED` status).
  - *Option B:* Introduce a dedicated generic `AuditLog` table with JSON diffs for every mutation.
- **Trade-offs:** The existing schema already embodies an immutable ledger approach for movements and transactions. Prohibiting hard deletes of financial entities provides sufficient audit protection without overhead.
- **Recommendation:** **Option A.** Enforce immutability of financial history in the service layer.
- **Affected Modules:** Invoices, Payments, Expenses, Inventory Ledgers.

---

### Decision 15: Target Hosting Topology & Infrastructure
- **Status:** Open decision
- **Question:** What is the target production hosting environment?
- **Analysis:** `plan.md` noted interest in low-cost/free-tier options (such as Oracle Cloud Always Free VM or Render/Railway) with Supabase PostgreSQL.
- **Options:**
  - *Option A (Recommended):*
    - **Frontend:** Vercel or Node.js container on self-hosted VPS.
    - **Backend:** Node.js Express service running under PM2 on an Ubuntu VPS (e.g., Oracle Cloud Always Free or low-cost Hetzner/DigitalOcean droplet) behind an Nginx reverse proxy with Let's Encrypt SSL.
    - **Database:** Supabase PostgreSQL with pooled connection (`DATABASE_URL`) for runtime and direct connection (`DIRECT_URL`) for migrations.
  - *Option B:* Fully managed PaaS (Railway / Render / Heroku). Higher monthly recurring cost once free tiers lapse.
- **Recommendation:** **Option A.** Keep backend portable via Docker / standard Node.js runtime and environment variables so it can deploy to any VPS or container host.
- **Affected Modules:** DevOps, Environment Config.

---

## 3. Summary of Recommendations for Sign-off

| # | Topic | Recommended Direction | Immediate Blocking Status |
|---|---|---|---|
| 1 | Client Identity | Hybrid 1:1 `User` & `Client` model | Resolved (Follows Schema) |
| 2 | Client Registration | Admin invitation only; no public sign-up | Ready for implementation |
| 3 | Auth Strategy | Dual JWT via HttpOnly cookies | Ready for implementation |
| 4 | Event Lifecycle | Strict state machine (`DRAFT` → `COMPLETED`) | Ready for implementation |
| 5 | Billing / Invoicing | Auto-sequenced `INV-YYYY-XXXX`, flat GST % | Ready for implementation |
| 6 | Commission Base | Admin-selected snapshot base per `TieUpEvent` | Ready for implementation |
| 7 | Commission Bookkeeping | Paid commission in `Expense`, Received in `TieUpTransaction` | Ready for implementation |
| 8 | Security Deposit | Partner-level asset with event transaction links | Ready for implementation |
| 9 | Inventory Costing | Reusable damage charging + consumable standard cost | Ready for implementation |
| 10 | Stock Reconciliation | 1 Expense to Many `PURCHASE` movements | Ready for implementation |
| 11 | Profit Reporting | Dual Perspective (Accrual Contract vs Cash Realized) | Ready for implementation |
| 12 | File Storage | Supabase Storage private buckets | Ready for implementation |
| 13 | Notifications | Deferred to Post-1.0 | Deferred |
| 14 | Audit Logging | Relational ledger & soft cancel (no hard deletes) | Ready for implementation |
| 15 | Deployment | Nginx + PM2 Node.js backend on VPS + Supabase DB | Ready for implementation |
