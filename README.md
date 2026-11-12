# Event Management System (EMS)

An enterprise-grade, full-stack operational and financial operating system tailored for event management organizations managing weddings, corporate galas, private celebrations, and banquets.

---

## 🏗️ System Architecture

The project is structured as a decoupled web application with strict separation of concerns:

```
EMS/
├── backend/                  # Node.js + Express 5 + TypeScript + Prisma 7 API
│   ├── prisma/               # Database schema & migrations (Supabase PostgreSQL)
│   ├── src/
│   │   ├── config/           # Environment & database runtime configuration
│   │   ├── controllers/      # HTTP request/response handlers
│   │   ├── middlewares/      # Auth, RBAC, error handling, Zod validation
│   │   ├── routes/           # Express router endpoints
│   │   ├── services/         # Core business logic & database transactions
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Decimal math, JWT, password hashing, errors
│   │   └── validations/      # Zod input validation schemas
│   └── .env.example          # Backend environment template
├── frontend/                 # Next.js 15 (App Router) + React 19 + Tailwind CSS
│   ├── src/
│   │   ├── app/              # Next.js App Router (Admin & Client Portal routes)
│   │   ├── components/       # Shadcn UI & layout components
│   │   ├── features/         # Domain-driven feature modules
│   │   ├── hooks/            # Custom React & TanStack Query hooks
│   │   ├── lib/              # API client & utility functions
│   │   └── stores/           # Zustand global state management
│   └── .env.example          # Frontend environment template
└── docs/                     # Product & Engineering Specifications
    ├── PRD.md                # Product Requirements Document
    ├── SRS.md                # Software Requirements Specification (IEEE 830)
    ├── LLD.md                # Low-Level Design Specification
    └── IMPLEMENTATION_ROADMAP.md # Implementation roadmap
```

---

## ⚡ Tech Stack

### Backend
- **Runtime:** Node.js (v20+ LTS)
- **Framework:** Express 5 (Strict ESM module format)
- **Language:** TypeScript 5.8+ (Strict type checking, `noUncheckedIndexedAccess`)
- **ORM & Database:** Prisma 7 with `@prisma/adapter-pg` & Supabase PostgreSQL
- **Security & Auth:** Dual-token JWT session via HttpOnly cookies, `bcrypt` password hashing, `helmet` header hardening, strict CORS whitelisting
- **Payment Gateway:** Razorpay API (HMAC-SHA256 signature verification)
- **Document Rendering:** PDFKit (in-memory dynamic Tax Invoice PDF generation)
- **Email:** Nodemailer SMTP (TLS 587)

### Frontend
- **Framework:** Next.js 15+ (App Router, Turbopack)
- **UI Library:** React 19, Tailwind CSS, Shadcn UI
- **State & Data Fetching:** TanStack Query v5, Zustand v5, React Hook Form, Zod

---

## ✨ Implemented Core Features

1. **Authentication & RBAC:**
   - Multi-role protection (`ADMIN` vs `CLIENT`).
   - Stateful JWT session with refresh token rotation and database revocation tracking.
2. **Client Registry & CRM:**
   - Profile management with GSTIN/PAN support.
   - Closed-invitation portal activation workflow via 32-byte cryptographic tokens.
3. **Event Lifecycle & Operations:**
   - Auto-sequenced `EVT-YYYY-XXXX` identifiers.
   - State machine: `DRAFT` → `CONFIRMED` → `PLANNING` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED`.
   - Day-of schedules (`EventSchedule`) and operational checklists (`EventTask`).
4. **Quotation Management & Pricing:**
   - Auto-sequenced `QUO-YYYY-XXXX`.
   - Percentage/fixed discount calculations, standard GST rates, and client view tracking.
   - One-click atomic conversion of accepted quotations into operational events.
5. **Invoices & Payment Engine:**
   - Auto-sequenced `INV-YYYY-XXXX` and `PAY-YYYY-XXXX`.
   - Proforma Invoices (advances) vs Final GST Tax Invoices with prior advance adjustments.
   - Multi-invoice split payment allocations.
   - Inline server-side PDF invoice generation (`/api/v1/invoices/:id/pdf`).
   - Razorpay online payment order creation and cryptographic verification.
6. **Inventory Management & Double-Entry Stock Ledger:**
   - Reusable gear vs consumable item classification.
   - Automated initial stock creation with opening purchase movements.
   - Real-time low stock alerts (`currentStock <= minimumStock`).
   - Event logistics dispatch (`EVENT_ISSUE`), good return (`EVENT_RETURN`), and on-site damage tracking (`DAMAGE`).
   - Mathematical audit reconciliation verifying zero discrepancy between physical stock and logged ledger movements.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v20.x or higher
- [Git](https://git-scm.com/)
- A [Supabase](https://supabase.com/) PostgreSQL database (or local PostgreSQL instance)

---

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your PostgreSQL DATABASE_URL, JWT secrets, and credentials

# Generate Prisma Client & Push Database Schema
npx prisma db push
npx prisma generate

# Seed initial Administrator account (admin@ems.local / Admin@123456)
npm run seed:admin

# Start backend development server (Runs on http://localhost:5000)
npm run dev
```

---

### 3. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# By default, NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1

# Start frontend development server (Runs on http://localhost:3000)
npm run dev
```

---

## 🧪 Automated Test Verification

The backend includes comprehensive, end-to-end integration test suites running against the database:

```bash
cd backend

# Run individual module test suites:
npm run test:phase2          # Authentication, Session & Access Control
npm run test:portal          # Client Portal Closed-Invitation Workflow
npm run test:status-history  # Client Status Transitions & Audit History
npm run test:calendar        # Calendar Activities & Day-of Schedules
npm run test:phase4          # Event Lifecycle & State Machine
npm run test:phase5          # Quotation Management & Atomic Event Conversion
npm run test:phase6          # Invoices, PDFKit Streaming & Razorpay Payments
npm run test:phase7          # Inventory Management & Double-Entry Movement Ledger
```

---

## 🌐 Production Deployment Guide

### A. Database (Supabase PostgreSQL)
1. In your Supabase project dashboard, obtain the **Transaction Connection Pooler** string (Port 6543) and **Direct Connection** string (Port 5432).
2. Push your schema:
   ```bash
   npx prisma db push
   ```
3. Seed the production administrator:
   ```bash
   npm run seed:admin
   ```

---

### B. Backend Deployment (Render / Railway / VPS / Docker)
- **Root Directory:** `backend`
- **Build Command:**
  ```bash
  npm run build
  ```
  *(This automatically executes `prisma generate && tsc`)*
- **Start Command:**
  ```bash
  npm start
  ```
  *(Runs `node dist/server.js`)*
- **Environment Variables Required in Production:**
  - `NODE_ENV`: `production`
  - `PORT`: Port assigned by host (e.g. `5000` or auto-assigned)
  - `DATABASE_URL`: Supabase Pooled Connection String
  - `DIRECT_URL`: Supabase Direct Connection String
  - `JWT_ACCESS_SECRET`: High-entropy random string ($\ge 32$ chars)
  - `JWT_REFRESH_SECRET`: High-entropy random string ($\ge 32$ chars)
  - `CORS_ORIGIN`: Your production frontend domain (e.g. `https://ems.yourdomain.com`)
  - `RAZORPAY_KEY_ID`: Live Razorpay Key
  - `RAZORPAY_KEY_SECRET`: Live Razorpay Secret
  - `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`: Production email credentials

---

### C. Frontend Deployment (Vercel / Render)
- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Build Command:** `next build`
- **Install Command:** `npm install`
- **Environment Variables:**
  - `NEXT_PUBLIC_API_URL`: Your deployed production backend URL (e.g. `https://api-ems.onrender.com/api/v1`)

---

## 🔑 Default Administrator Credentials
- **Email:** `admin@ems.local`
- **Password:** Defined via `INITIAL_ADMIN_PASSWORD` in your `.env` (default in seed is user-configured)
- **Role:** `ADMIN`

*(Change the administrator password in production immediately upon deployment).*

---

## 📜 License
Proprietary & Confidential. All rights reserved.
