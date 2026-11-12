import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import app from "../app.js";
import { prisma, Prisma } from "../lib/prisma.js";
import {
  USERROLE,
  InvoiceStatus,
  InvoiceType,
  DiscountType,
  PaymentMethod,
  PaymentType,
  PaymentStatus,
  EventStatus,
} from "../generated/prisma/enums.js";
import { hashPassword } from "../utils/password.js";

const SCHEMA_PRISMA_PATH = path.resolve(process.cwd(), "prisma/schema.prisma");

interface TestResult {
  section: string;
  name: string;
  passed: boolean;
  error?: string | undefined;
  details?: unknown;
}

const results: TestResult[] = [];

function recordTest(section: string, name: string, passed: boolean, error?: string, details?: unknown) {
  results.push({ section, name, passed, error, details });
  const statusIcon = passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
  console.log(`  ${statusIcon} ${name}`);
  if (!passed && error) {
    console.error(`         \x1b[31mError: ${error}\x1b[0m`);
    if (details) {
      console.error(`         \x1b[33mDetails: ${JSON.stringify(details)}\x1b[0m`);
    }
  }
}

function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
}

async function runPhase6InvoicesAndPaymentsTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS PHASE 6 INVOICES & CLIENT PAYMENT ENGINE QUALITY TEST SUITE");
  console.log("================================================================================\n");

  let server: http.Server | null = null;
  let baseUrl = "";
  let initialSchemaHash = "";

  // Tracking sets for comprehensive teardown
  const createdClientIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdEventIds = new Set<string>();
  const createdInvoiceIds = new Set<string>();
  const createdPaymentIds = new Set<string>();

  // API Request Helper with transient retry for remote pooler connection drops
  async function apiRequest(
    urlPath: string,
    options: {
      method?: string;
      token?: string;
      cookie?: string;
      body?: unknown;
    } = {}
  ): Promise<{ status: number; data: any; headers: Headers }> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.token) {
      headers["Authorization"] = `Bearer ${options.token}`;
    }
    if (options.cookie) {
      headers["Cookie"] = options.cookie;
    }

    const init: RequestInit = {
      method: options.method || "GET",
      headers,
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${baseUrl}${urlPath}`, init);
        let data: any = null;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const text = await res.text();
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        return { status: res.status, data, headers: res.headers };
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    throw lastError;
  }

  try {
    // 0. Record initial schema hash
    initialSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    console.log(`[Schema Check] Initial prisma/schema.prisma SHA-256: ${initialSchemaHash}`);

    // Start ephemeral HTTP server
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const address = server!.address() as { address: string; port: number };
        baseUrl = `http://127.0.0.1:${address.port}`;
        console.log(`[Test Server] Ephemeral HTTP Server listening on ${baseUrl}\n`);
        resolve();
      });
    });

    // -------------------------------------------------------------------------
    // SETUP: Administrator & Test Clients/Users/Events
    // -------------------------------------------------------------------------
    console.log("==> SETUP: Authenticating Administrator");
    const adminPassword = "Admin@123456";
    const hashedAdminPassword = await hashPassword(adminPassword);

    let admin = await prisma.user.findFirst({
      where: { role: USERROLE.ADMIN, isActive: true },
    });

    if (admin) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { passwordHash: hashedAdminPassword },
      });
    } else {
      admin = await prisma.user.create({
        data: {
          name: "System Admin",
          email: "admin@ems.local",
          passwordHash: hashedAdminPassword,
          role: USERROLE.ADMIN,
          isActive: true,
        },
      });
      createdUserIds.add(admin.id);
    }

    const adminLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: admin.email,
        password: adminPassword,
      },
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.data?.data?.accessToken) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }

    const adminToken = adminLoginRes.data.data.accessToken as string;
    const adminUser = adminLoginRes.data.data.user;
    console.log(`  [Admin Authenticated] ID: ${adminUser.id}, Email: ${adminUser.email}\n`);

    console.log("==> SETUP: Creating Test Clients, Users, and Associated Events");
    const uniqueSuffix = Date.now().toString().slice(-6);

    const clientA = await prisma.client.create({
      data: {
        name: `Acme Corp ${uniqueSuffix}`,
        email: `client.a.${uniqueSuffix}@example.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        address: "Tower 1, Cyber City",
        city: "Gurugram",
      },
    });
    createdClientIds.add(clientA.id);

    const clientB = await prisma.client.create({
      data: {
        name: `Beta Industries ${uniqueSuffix}`,
        email: `client.b.${uniqueSuffix}@example.com`,
        phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
        address: "Plot 42, Tech Park",
        city: "Noida",
      },
    });
    createdClientIds.add(clientB.id);

    const hashedTestPassword = await hashPassword("ClientPassword123!");

    const userA = await prisma.user.create({
      data: {
        name: `User Acme ${uniqueSuffix}`,
        email: `usera.${uniqueSuffix}@example.com`,
        passwordHash: hashedTestPassword,
        role: USERROLE.CLIENT,
        clientId: clientA.id,
        isActive: true,
      },
    });
    createdUserIds.add(userA.id);

    const userB = await prisma.user.create({
      data: {
        name: `User Beta ${uniqueSuffix}`,
        email: `userb.${uniqueSuffix}@example.com`,
        passwordHash: hashedTestPassword,
        role: USERROLE.CLIENT,
        clientId: clientB.id,
        isActive: true,
      },
    });
    createdUserIds.add(userB.id);

    const standaloneUser = await prisma.user.create({
      data: {
        name: `Standalone User ${uniqueSuffix}`,
        email: `standalone.${uniqueSuffix}@example.com`,
        passwordHash: hashedTestPassword,
        role: USERROLE.CLIENT,
        clientId: null,
        isActive: true,
      },
    });
    createdUserIds.add(standaloneUser.id);

    // Create an event for Client A
    const eventA = await prisma.event.create({
      data: {
        eventNumber: `EVT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        clientId: clientA.id,
        title: "Acme Annual Summit 2026",
        eventType: "Corporate Conference",
        eventDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: EventStatus.CONFIRMED,
        createdById: adminUser.id,
      },
    });
    createdEventIds.add(eventA.id);

    // Login user tokens
    const loginARes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: { email: userA.email, password: "ClientPassword123!" },
    });
    const tokenA = loginARes.data.data.accessToken as string;

    const loginBRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: { email: userB.email, password: "ClientPassword123!" },
    });
    const tokenB = loginBRes.data.data.accessToken as string;

    const loginStandaloneRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: { email: standaloneUser.email, password: "ClientPassword123!" },
    });
    const tokenStandalone = loginStandaloneRes.data.data.accessToken as string;

    console.log(`  [Setup Complete] Client A (${clientA.id}), Client B (${clientB.id}), Event A (${eventA.id})\n`);

    // =========================================================================
    // SECTION 1: Itemized Invoicing & Sequencing (INV-YYYY-XXXX)
    // =========================================================================
    console.log("==> SECTION 1: Itemized Invoicing & Sequencing (INV-YYYY-XXXX)");

    // 1.1 Create Invoice with Percentage Discount
    // Subtotal: 10 * 1500 + 1 * 5000 = 15000 + 5000 = 20000
    // Discount: 10% = 2000
    // Taxable: 18000
    // Tax: 18% = 3240
    // Total: 18000 + 3240 = 21240
    const invoicePayload1 = {
      clientId: clientA.id,
      eventId: eventA.id,
      title: "Conference Audio-Visual & Production Invoice",
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      taxRate: 18,
      notes: "Payment due within 14 days of invoice date",
      terms: "18% interest per month on delayed payments",
      items: [
        {
          itemName: "Wireless Microphone Sets",
          description: "UHF handheld microphone sets with receiver",
          quantity: 10,
          unit: "sets",
          unitPrice: 1500, // 15,000
          sortOrder: 1,
          type: InvoiceType.FINAL,
        },
        {
          itemName: "Main Stage Truss & LED Backdrop",
          description: "16x9 ft P3 LED Video Wall",
          quantity: 1,
          unit: "setup",
          unitPrice: 5000, // 5,000
          sortOrder: 2,
          type: InvoiceType.FINAL,
        },
      ],
    };

    const resCreateInv1 = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: invoicePayload1,
    });

    const inv1 = resCreateInv1.data?.data;
    if (inv1?.id) createdInvoiceIds.add(inv1.id);

    recordTest(
      "Section 1",
      "1.1 Invoice creation returns HTTP 201 Created with valid payload",
      resCreateInv1.status === 201 && inv1 && inv1.id,
      `Expected 201, received: ${resCreateInv1.status}`,
      resCreateInv1.data
    );

    recordTest(
      "Section 1",
      "1.2 Auto-generated invoiceNumber matches sequential format INV-YYYY-XXXX",
      inv1 && /^INV-\d{4}-\d{4}$/.test(inv1.invoiceNumber),
      `Expected INV-YYYY-XXXX, received: ${inv1?.invoiceNumber}`
    );

    recordTest(
      "Section 1",
      "1.3 Initial default status is strictly DRAFT",
      inv1 && inv1.status === InvoiceStatus.DRAFT,
      `Expected DRAFT, received: ${inv1?.status}`
    );

    recordTest(
      "Section 1",
      "1.4 Accurate Decimal Calculations: Subtotal (₹20,000), 10% Discount (₹2,000), 18% Tax (₹3,240), Total (₹21,240)",
      Number(inv1?.subtotal) === 20000 &&
        Number(inv1?.taxAmount) === 3240 &&
        Number(inv1?.totalAmount) === 21240 &&
        Number(inv1?.paidAmount) === 0 &&
        Number(inv1?.balanceAmount) === 21240,
      `Subtotal: ${inv1?.subtotal}, taxAmount: ${inv1?.taxAmount}, total: ${inv1?.totalAmount}`
    );

    // 1.5 Strict sequential increment check
    const invoicePayload2 = {
      clientId: clientA.id,
      title: "Stage Carpentry & Rigging",
      invoiceDate: new Date().toISOString(),
      discountType: DiscountType.FIXED,
      discountValue: 1000,
      taxRate: 12,
      items: [
        {
          itemName: "Stage Platform Extension",
          quantity: 2,
          unit: "sections",
          unitPrice: 5000, // 10,000
          type: InvoiceType.FINAL,
        },
      ],
    };

    const resCreateInv2 = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: invoicePayload2,
    });

    const inv2 = resCreateInv2.data?.data;
    if (inv2?.id) createdInvoiceIds.add(inv2.id);

    const seq1 = parseInt(inv1.invoiceNumber.split("-")[2], 10);
    const seq2 = parseInt(inv2.invoiceNumber.split("-")[2], 10);

    recordTest(
      "Section 1",
      "1.5 Strict sequential increment: Invoice 2 sequence is exactly Invoice 1 sequence + 1",
      seq2 === seq1 + 1,
      `Expected ${seq1 + 1}, received: ${seq2}`
    );

    // Fixed discount calculation check:
    // Subtotal: 10,000 - 1,000 = 9,000 taxable. 12% tax = 1,080. Total = 10,080.
    recordTest(
      "Section 1",
      "1.6 Fixed Discount Calculation: Subtotal (₹10,000) - Fixed (₹1,000) + 12% Tax (₹1,080) = Total (₹10,080)",
      Number(inv2?.subtotal) === 10000 &&
        Number(inv2?.taxAmount) === 1080 &&
        Number(inv2?.totalAmount) === 10080,
      `Subtotal: ${inv2?.subtotal}, tax: ${inv2?.taxAmount}, total: ${inv2?.totalAmount}`
    );

    // 1.7 Zod Validation: Title < 2 characters rejected with HTTP 422
    const resShortTitle = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "X",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Item", quantity: 1, unitPrice: 100, type: InvoiceType.FINAL }],
      },
    });
    recordTest(
      "Section 1",
      "1.7 Validation: Title < 2 characters rejected with HTTP 422 VALIDATION_ERROR",
      resShortTitle.status === 422,
      `Expected 422, received: ${resShortTitle.status}`
    );

    // 1.8 Zod Validation: Empty items array rejected with HTTP 422
    const resEmptyItems = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Valid Title",
        invoiceDate: new Date().toISOString(),
        items: [],
      },
    });
    recordTest(
      "Section 1",
      "1.8 Validation: Empty items array rejected with HTTP 422 VALIDATION_ERROR",
      resEmptyItems.status === 422,
      `Expected 422, received: ${resEmptyItems.status}`
    );

    // 1.9 Zod Validation: Quantity <= 0 rejected with HTTP 422
    const resZeroQuantity = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Valid Title",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Item", quantity: 0, unitPrice: 100, type: InvoiceType.FINAL }],
      },
    });
    recordTest(
      "Section 1",
      "1.9 Validation: Quantity <= 0 rejected with HTTP 422 VALIDATION_ERROR",
      resZeroQuantity.status === 422,
      `Expected 422, received: ${resZeroQuantity.status}`
    );

    // 1.10 Zod Validation: Negative unitPrice rejected with HTTP 422
    const resNegativePrice = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Valid Title",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Item", quantity: 1, unitPrice: -10, type: InvoiceType.FINAL }],
      },
    });
    recordTest(
      "Section 1",
      "1.10 Validation: Negative unitPrice rejected with HTTP 422 VALIDATION_ERROR",
      resNegativePrice.status === 422,
      `Expected 422, received: ${resNegativePrice.status}`
    );

    // 1.11 Zod Validation: dueDate < invoiceDate rejected with HTTP 422
    const resInvalidDates = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Valid Title",
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ itemName: "Item", quantity: 1, unitPrice: 100, type: InvoiceType.FINAL }],
      },
    });
    recordTest(
      "Section 1",
      "1.11 Validation: dueDate < invoiceDate rejected with HTTP 422 VALIDATION_ERROR",
      resInvalidDates.status === 422,
      `Expected 422, received: ${resInvalidDates.status}`
    );

    // 1.12 Non-existent clientId returns HTTP 404 NOT_FOUND
    const resGhostClient = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: "00000000-0000-4000-8000-000000000000",
        title: "Ghost Client Invoice",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Item", quantity: 1, unitPrice: 100, type: InvoiceType.FINAL }],
      },
    });
    recordTest(
      "Section 1",
      "1.12 Non-existent clientId returns HTTP 404 NOT_FOUND",
      resGhostClient.status === 404,
      `Expected 404, received: ${resGhostClient.status}`
    );

    // 1.13 Non-existent eventId returns HTTP 404 NOT_FOUND
    const resGhostEvent = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        eventId: "00000000-0000-4000-8000-000000000000",
        title: "Ghost Event Invoice",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Item", quantity: 1, unitPrice: 100, type: InvoiceType.FINAL }],
      },
    });
    recordTest(
      "Section 1",
      "1.13 Non-existent eventId returns HTTP 404 NOT_FOUND",
      resGhostEvent.status === 404,
      `Expected 404, received: ${resGhostEvent.status}`
    );

    // 1.14 Event belonging to different client rejected with HTTP 400 BAD_REQUEST
    const resMismatchEvent = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientB.id, // Mismatched client with eventA (belongs to clientA)
        eventId: eventA.id,
        title: "Client Mismatch Invoice",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Item", quantity: 1, unitPrice: 100, type: InvoiceType.FINAL }],
      },
    });
    recordTest(
      "Section 1",
      "1.14 Client/Event mismatch rejected with HTTP 400 BAD_REQUEST",
      resMismatchEvent.status === 400,
      `Expected 400, received: ${resMismatchEvent.status}`
    );

    // 1.15 Security: Client role POST /api/v1/invoices returns HTTP 403 Forbidden
    const resClientCreate = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: tokenA,
      body: {
        clientId: clientA.id,
        title: "Unauthorized Client Invoice",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Item", quantity: 1, unitPrice: 100, type: InvoiceType.FINAL }],
      },
    });
    recordTest(
      "Section 1",
      "1.15 Security: Client role POST /api/v1/invoices returns HTTP 403 Forbidden",
      resClientCreate.status === 403,
      `Expected 403, received: ${resClientCreate.status}`
    );

    // 1.16 Invoice for Client B created successfully by Admin
    const resCreateInvB = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientB.id,
        title: "Beta Tech Summit Invoice",
        invoiceDate: new Date().toISOString(),
        items: [
          {
            itemName: "Keynote Hall Acoustic Treatment",
            quantity: 1,
            unitPrice: 50000,
            type: InvoiceType.FINAL,
          },
        ],
      },
    });
    const invB = resCreateInvB.data?.data;
    if (invB?.id) createdInvoiceIds.add(invB.id);

    recordTest(
      "Section 1",
      "1.16 Invoice for Client B created successfully by Admin (HTTP 201)",
      resCreateInvB.status === 201 && invB?.clientId === clientB.id,
      `Status: ${resCreateInvB.status}`
    );

    // =========================================================================
    // SECTION 2: Invoice Retrieval, Search & RBAC Scoping
    // =========================================================================
    console.log("\n==> SECTION 2: Invoice Retrieval, Search & RBAC Scoping");

    // 2.1 Pagination
    const resPage = await apiRequest("/api/v1/invoices?page=1&limit=2", {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.1 Pagination: GET /api/v1/invoices?page=1&limit=2 returns exact chunk and valid meta attributes",
      resPage.status === 200 &&
        resPage.data?.data?.length <= 2 &&
        resPage.data?.meta?.page === 1 &&
        resPage.data?.meta?.total >= 3,
      `Status: ${resPage.status}, meta: ${JSON.stringify(resPage.data?.meta)}`
    );

    // 2.2 Filter by status
    const resStatusFilter = await apiRequest("/api/v1/invoices?status=DRAFT", {
      token: adminToken,
    });
    const allDraft = (resStatusFilter.data?.data || []).every(
      (inv: any) => inv.status === InvoiceStatus.DRAFT
    );
    recordTest(
      "Section 2",
      "2.2 Filter by status: GET /api/v1/invoices?status=DRAFT returns only DRAFT invoices",
      resStatusFilter.status === 200 && allDraft && resStatusFilter.data?.data?.length > 0,
      `Count: ${resStatusFilter.data?.data?.length}`
    );

    // 2.3 Filter by clientId (Admin)
    const resClientAFilter = await apiRequest(`/api/v1/invoices?clientId=${clientA.id}`, {
      token: adminToken,
    });
    const allClientA = (resClientAFilter.data?.data || []).every(
      (inv: any) => inv.clientId === clientA.id
    );
    recordTest(
      "Section 2",
      "2.3 Filter by clientId: Admin filter ?clientId=... returns only matching invoices",
      resClientAFilter.status === 200 && allClientA && resClientAFilter.data?.data?.length >= 2,
      `Count: ${resClientAFilter.data?.data?.length}`
    );

    // 2.4 Filter by eventId
    const resEventFilter = await apiRequest(`/api/v1/invoices?eventId=${eventA.id}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.4 Filter by eventId: GET /api/v1/invoices?eventId=... returns invoices linked to that event",
      resEventFilter.status === 200 &&
        resEventFilter.data?.data?.some((inv: any) => inv.id === inv1.id),
      `Count: ${resEventFilter.data?.data?.length}`
    );

    // 2.5 Search by title or invoiceNumber
    const resSearch = await apiRequest(`/api/v1/invoices?search=${inv1.invoiceNumber}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      `2.5 Search: GET /api/v1/invoices?search=${inv1.invoiceNumber} matches exact invoiceNumber`,
      resSearch.status === 200 &&
        resSearch.data?.data?.length === 1 &&
        resSearch.data?.data[0]?.id === inv1.id,
      `Count: ${resSearch.data?.data?.length}`
    );

    // 2.6 Multi-tenant RBAC: Admin sees all invoices across Client A and Client B
    const resAdminList = await apiRequest("/api/v1/invoices?limit=100", {
      token: adminToken,
    });
    const adminHasA = resAdminList.data?.data?.some((inv: any) => inv.clientId === clientA.id);
    const adminHasB = resAdminList.data?.data?.some((inv: any) => inv.clientId === clientB.id);
    recordTest(
      "Section 2",
      "2.6 RBAC Scoping: Admin sees all invoices across Client A and Client B",
      resAdminList.status === 200 && adminHasA && adminHasB,
      `Has A: ${adminHasA}, Has B: ${adminHasB}`
    );

    // 2.7 RBAC: Client A user sees ONLY Client A invoices (zero leakage of Client B)
    const resClientAList = await apiRequest("/api/v1/invoices?limit=100", {
      token: tokenA,
    });
    const clientAInvoices = resClientAList.data?.data || [];
    const clientAOnlyHasA = clientAInvoices.every((inv: any) => inv.clientId === clientA.id);
    const clientALeaksB = clientAInvoices.some((inv: any) => inv.clientId === clientB.id);
    recordTest(
      "Section 2",
      "2.7 RBAC Scoping: Client A user sees ONLY their own invoices (zero leakage of Client B)",
      resClientAList.status === 200 && clientAOnlyHasA && !clientALeaksB && clientAInvoices.length >= 2,
      `Count: ${clientAInvoices.length}, leaks B: ${clientALeaksB}`
    );

    // 2.8 RBAC: Standalone client user receives empty list
    const resStandaloneList = await apiRequest("/api/v1/invoices", {
      token: tokenStandalone,
    });
    recordTest(
      "Section 2",
      "2.8 RBAC Scoping: Standalone client user (clientId=null) receives empty invoice list (total=0)",
      resStandaloneList.status === 200 &&
        resStandaloneList.data?.data?.length === 0 &&
        resStandaloneList.data?.meta?.total === 0,
      `Total: ${resStandaloneList.data?.meta?.total}`
    );

    // 2.9 Admin views single invoice details
    const resAdminGet = await apiRequest(`/api/v1/invoices/${inv1.id}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.9 Admin can access single invoice details across any client (HTTP 200)",
      resAdminGet.status === 200 && resAdminGet.data?.data?.id === inv1.id,
      `Status: ${resAdminGet.status}`
    );

    // 2.10 Client user views own invoice
    const resClientGetOwn = await apiRequest(`/api/v1/invoices/${inv1.id}`, {
      token: tokenA,
    });
    recordTest(
      "Section 2",
      "2.10 Client user can access their own invoice details (HTTP 200)",
      resClientGetOwn.status === 200 && resClientGetOwn.data?.data?.id === inv1.id,
      `Status: ${resClientGetOwn.status}`
    );

    // 2.11 IDOR Protection: Client A accessing Client B invoice receives HTTP 403 Forbidden
    const resIdor = await apiRequest(`/api/v1/invoices/${invB.id}`, {
      token: tokenA,
    });
    recordTest(
      "Section 2",
      "2.11 IDOR Protection: Client A accessing Client B invoice receives HTTP 403 Forbidden",
      resIdor.status === 403,
      `Expected 403, received: ${resIdor.status}`
    );

    // 2.12 Live Balance Calculation Endpoint: GET /api/v1/invoices/:id/balance
    const resBalance = await apiRequest(`/api/v1/invoices/${inv1.id}/balance`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.12 Balance Calculation: GET /api/v1/invoices/:id/balance returns accurate total, paid, and balance",
      resBalance.status === 200 &&
        Number(resBalance.data?.data?.totalAmount) === 21240 &&
        Number(resBalance.data?.data?.paidAmount) === 0 &&
        Number(resBalance.data?.data?.balanceAmount) === 21240,
      `Balance: ${JSON.stringify(resBalance.data?.data)}`
    );

    // 2.13 PDF Streaming: Admin downloads invoice PDF via GET /api/v1/invoices/:id/pdf
    const resPdfAdmin = await apiRequest(`/api/v1/invoices/${inv1.id}/pdf`, {
      token: adminToken,
    });
    const isPdfAdmin =
      resPdfAdmin.status === 200 &&
      (resPdfAdmin.headers.get("content-type")?.includes("application/pdf") || false) &&
      (typeof resPdfAdmin.data === "string" && resPdfAdmin.data.startsWith("%PDF"));
    recordTest(
      "Section 2",
      "2.13 PDF Generation & Streaming: Admin GET /api/v1/invoices/:id/pdf returns HTTP 200 with application/pdf & valid PDF magic bytes",
      isPdfAdmin,
      `Status: ${resPdfAdmin.status}, Content-Type: ${resPdfAdmin.headers.get("content-type")}`
    );

    // 2.14 PDF Streaming: Client A downloads their own invoice PDF
    const resPdfClient = await apiRequest(`/api/v1/invoices/${inv1.id}/pdf`, {
      token: tokenA,
    });
    const isPdfClient =
      resPdfClient.status === 200 &&
      (resPdfClient.headers.get("content-type")?.includes("application/pdf") || false);
    recordTest(
      "Section 2",
      "2.14 Client Access: Client can download their own invoice PDF (HTTP 200, application/pdf)",
      isPdfClient,
      `Status: ${resPdfClient.status}`
    );

    // 2.15 IDOR Protection on PDF: Client A downloading Client B invoice PDF returns HTTP 403 Forbidden
    const resPdfIdor = await apiRequest(`/api/v1/invoices/${invB.id}/pdf`, {
      token: tokenA,
    });
    recordTest(
      "Section 2",
      "2.15 IDOR Protection: Client A downloading Client B invoice PDF returns HTTP 403 Forbidden",
      resPdfIdor.status === 403,
      `Expected 403, received: ${resPdfIdor.status}`
    );

    // 2.16 Unauthenticated request to PDF endpoint returns HTTP 401 Unauthorized
    const resPdfUnauth = await apiRequest(`/api/v1/invoices/${inv1.id}/pdf`);
    recordTest(
      "Section 2",
      "2.16 Security: Unauthenticated GET /api/v1/invoices/:id/pdf returns HTTP 401 Unauthorized",
      resPdfUnauth.status === 401,
      `Expected 401, received: ${resPdfUnauth.status}`
    );

    // =========================================================================
    // SECTION 3: Invoice State Transitions, Updates & Deletion
    // =========================================================================
    console.log("\n==> SECTION 3: Invoice State Transitions, Updates & Deletion");

    // 3.1 Transition: DRAFT -> SENT sets sentAt timestamp
    const resSendInv = await apiRequest(`/api/v1/invoices/${inv1.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: InvoiceStatus.SENT,
        notes: "Tax invoice dispatched via email",
      },
    });
    const inv1Sent = resSendInv.data?.data;
    recordTest(
      "Section 3",
      "3.1 Legal State Transition: DRAFT -> SENT returns HTTP 200 OK and sets sentAt timestamp",
      resSendInv.status === 200 &&
        inv1Sent?.status === InvoiceStatus.SENT &&
        inv1Sent?.sentAt !== null,
      `Status: ${inv1Sent?.status}, sentAt: ${inv1Sent?.sentAt}`
    );

    // Also send Invoice 2
    await apiRequest(`/api/v1/invoices/${inv2.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: InvoiceStatus.SENT },
    });

    // 3.2 Transition: SENT -> OVERDUE
    const resOverdue = await apiRequest(`/api/v1/invoices/${inv2.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: InvoiceStatus.OVERDUE,
        notes: "Due date elapsed without receipt",
      },
    });
    recordTest(
      "Section 3",
      "3.2 Legal State Transition: SENT -> OVERDUE returns HTTP 200 OK",
      resOverdue.status === 200 && resOverdue.data?.data?.status === InvoiceStatus.OVERDUE,
      `Status: ${resOverdue.data?.data?.status}`
    );

    // Create a disposable DRAFT invoice for update and deletion tests
    const resDraftForUpdate = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Disposable DRAFT Invoice",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Original Item", quantity: 1, unitPrice: 1000, type: InvoiceType.FINAL }],
      },
    });
    const invForUpdate = resDraftForUpdate.data?.data;
    if (invForUpdate?.id) createdInvoiceIds.add(invForUpdate.id);

    // 3.3 Admin updates invoice details and replaces items
    // New items: 2 * 3000 = 6000. 10% discount = 600. 18% tax = 972. Total = 6372.
    const resUpdateInv = await apiRequest(`/api/v1/invoices/${invForUpdate.id}`, {
      method: "PUT",
      token: adminToken,
      body: {
        title: "Upgraded Disposable Invoice",
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        taxRate: 18,
        items: [
          {
            itemName: "Upgraded Sound Mixer Console",
            quantity: 2,
            unitPrice: 3000,
            type: InvoiceType.FINAL,
          },
        ],
      },
    });
    const updatedInv = resUpdateInv.data?.data;
    recordTest(
      "Section 3",
      "3.3 Admin updates invoice details and replaces line items (HTTP 200, Recalculated total = ₹6,372)",
      resUpdateInv.status === 200 &&
        updatedInv?.title === "Upgraded Disposable Invoice" &&
        Number(updatedInv?.subtotal) === 6000 &&
        Number(updatedInv?.totalAmount) === 6372,
      `Subtotal: ${updatedInv?.subtotal}, total: ${updatedInv?.totalAmount}`
    );

    // 3.4 Cannot edit invoice in CANCELLED status
    // Cancel invForUpdate
    await apiRequest(`/api/v1/invoices/${invForUpdate.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: InvoiceStatus.CANCELLED },
    });

    const resEditCancelled = await apiRequest(`/api/v1/invoices/${invForUpdate.id}`, {
      method: "PUT",
      token: adminToken,
      body: { title: "Attempt to edit cancelled invoice" },
    });
    recordTest(
      "Section 3",
      "3.4 Cannot edit invoice in CANCELLED status (rejected with HTTP 400 BAD_REQUEST)",
      resEditCancelled.status === 400,
      `Expected 400, received: ${resEditCancelled.status}`
    );

    // 3.5 Security: Client role PUT /api/v1/invoices/:id returns HTTP 403 Forbidden
    const resClientPut = await apiRequest(`/api/v1/invoices/${invForUpdate.id}`, {
      method: "PUT",
      token: tokenA,
      body: { title: "Client Edit Attempt" },
    });
    recordTest(
      "Section 3",
      "3.5 Security: Client role PUT /api/v1/invoices/:id returns HTTP 403 Forbidden",
      resClientPut.status === 403,
      `Expected 403, received: ${resClientPut.status}`
    );

    // 3.6 Security: Client role PATCH /api/v1/invoices/:id/status returns HTTP 403 Forbidden
    const resClientPatch = await apiRequest(`/api/v1/invoices/${invForUpdate.id}/status`, {
      method: "PATCH",
      token: tokenA,
      body: { status: InvoiceStatus.SENT },
    });
    recordTest(
      "Section 3",
      "3.6 Security: Client role PATCH /api/v1/invoices/:id/status returns HTTP 403 Forbidden",
      resClientPatch.status === 403,
      `Expected 403, received: ${resClientPatch.status}`
    );

    // 3.7 Admin deletes unlinked invoice (invForUpdate)
    const itemsCountBefore = await prisma.invoiceItem.count({
      where: { invoiceId: invForUpdate.id },
    });

    const resDeleteInv = await apiRequest(`/api/v1/invoices/${invForUpdate.id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 3",
      "3.7 Admin deletes unlinked invoice (HTTP 200 OK)",
      resDeleteInv.status === 200,
      `Status: ${resDeleteInv.status}`
    );

    // 3.8 Cascading deletion of InvoiceItem rows
    const itemsCountAfter = await prisma.invoiceItem.count({
      where: { invoiceId: invForUpdate.id },
    });
    recordTest(
      "Section 3",
      "3.8 Cascading deletion: Child InvoiceItem rows purged automatically (was > 0, now 0)",
      itemsCountBefore > 0 && itemsCountAfter === 0,
      `Before: ${itemsCountBefore}, After: ${itemsCountAfter}`
    );
    createdInvoiceIds.delete(invForUpdate.id);

    // 3.9 Deleting already purged / non-existent invoice returns HTTP 404 NOT_FOUND
    const resDelete404 = await apiRequest(`/api/v1/invoices/${invForUpdate.id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 3",
      "3.9 Deleting already purged / non-existent invoice returns HTTP 404 NOT_FOUND",
      resDelete404.status === 404,
      `Expected 404, received: ${resDelete404.status}`
    );

    // =========================================================================
    // SECTION 4: Payment Recording & Sequencing (PAY-YYYY-XXXX)
    // =========================================================================
    console.log("\n==> SECTION 4: Payment Recording & Sequencing (PAY-YYYY-XXXX)");

    // 4.1 Record Standalone Advance Payment for Client A
    const paymentPayload1 = {
      clientId: clientA.id,
      eventId: eventA.id,
      amount: 5000,
      paymentType: PaymentType.ADVANCE,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentDate: new Date().toISOString(),
      transactionReference: "NEFT-HDFC-998877",
      notes: "Advance booking payment received via RTGS/NEFT",
      allocations: [],
    };

    const resCreatePay1 = await apiRequest("/api/v1/payments", {
      method: "POST",
      token: adminToken,
      body: paymentPayload1,
    });

    const pay1 = resCreatePay1.data?.data;
    if (pay1?.id) createdPaymentIds.add(pay1.id);

    recordTest(
      "Section 4",
      "4.1 Standalone Payment recording returns HTTP 201 Created with valid payload",
      resCreatePay1.status === 201 && pay1 && pay1.id,
      `Expected 201, received: ${resCreatePay1.status}`,
      resCreatePay1.data
    );

    recordTest(
      "Section 4",
      "4.2 Auto-generated paymentNumber matches sequential format PAY-YYYY-XXXX",
      pay1 && /^PAY-\d{4}-\d{4}$/.test(pay1.paymentNumber),
      `Expected PAY-YYYY-XXXX, received: ${pay1?.paymentNumber}`
    );

    recordTest(
      "Section 4",
      "4.3 Default payment status is strictly COMPLETED",
      pay1 && pay1.status === PaymentStatus.COMPLETED,
      `Expected COMPLETED, received: ${pay1?.status}`
    );

    // 4.4 Sequential increment check
    const resCreatePay2 = await apiRequest("/api/v1/payments", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        amount: 2000,
        paymentType: PaymentType.PARTIAL,
        paymentMethod: PaymentMethod.UPI,
        paymentDate: new Date().toISOString(),
        transactionReference: "UPI-ICICI-112233",
      },
    });

    const pay2 = resCreatePay2.data?.data;
    if (pay2?.id) createdPaymentIds.add(pay2.id);

    const paySeq1 = parseInt(pay1.paymentNumber.split("-")[2], 10);
    const paySeq2 = parseInt(pay2.paymentNumber.split("-")[2], 10);

    recordTest(
      "Section 4",
      "4.4 Strict sequential increment: Payment 2 sequence is exactly Payment 1 sequence + 1",
      paySeq2 === paySeq1 + 1,
      `Expected ${paySeq1 + 1}, received: ${paySeq2}`
    );

    // 4.5 Security: Client role POST /api/v1/payments returns HTTP 403 Forbidden
    const resClientPay = await apiRequest("/api/v1/payments", {
      method: "POST",
      token: tokenA,
      body: {
        clientId: clientA.id,
        amount: 1000,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: new Date().toISOString(),
      },
    });
    recordTest(
      "Section 4",
      "4.5 Security: Client role POST /api/v1/payments returns HTTP 403 Forbidden",
      resClientPay.status === 403,
      `Expected 403, received: ${resClientPay.status}`
    );

    // =========================================================================
    // SECTION 5: Multi-Invoice Payment Allocations & Automatic Invoice Status Engine
    // =========================================================================
    console.log("\n==> SECTION 5: Multi-Invoice Payment Allocations & Automatic Invoice Status Engine");

    // Setup: Let's create two clean invoices for Client A to test allocations
    // Target Invoice Alpha: Total = ₹10,000 (100 * 100)
    const resInvAlpha = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Alpha Invoice - Production Services",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Production Days", quantity: 10, unitPrice: 1000, type: InvoiceType.FINAL }],
      },
    });
    const invAlpha = resInvAlpha.data?.data;
    createdInvoiceIds.add(invAlpha.id);

    // Target Invoice Beta: Total = ₹8,000 (8 * 1000)
    const resInvBeta = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Beta Invoice - Lighting Services",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Lighting Setup", quantity: 8, unitPrice: 1000, type: InvoiceType.FINAL }],
      },
    });
    const invBeta = resInvBeta.data?.data;
    createdInvoiceIds.add(invBeta.id);

    // 5.1 Single invoice partial allocation:
    // Invoice Alpha total = ₹10,000. Pay ₹4,000 allocated to it.
    // Invoice status must transition to PARTIALLY_PAID.
    const resPayPartial = await apiRequest("/api/v1/payments", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        amount: 4000,
        paymentType: PaymentType.PARTIAL,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentDate: new Date().toISOString(),
        transactionReference: "TXN-PARTIAL-4000",
        allocations: [
          {
            invoiceId: invAlpha.id,
            amount: 4000,
          },
        ],
      },
    });
    const payPartial = resPayPartial.data?.data;
    if (payPartial?.id) createdPaymentIds.add(payPartial.id);

    const dbInvAlphaAfterPartial = await prisma.invoice.findUnique({
      where: { id: invAlpha.id },
      include: { paymentAllocations: true },
    });
    const alphaPaidPartial = Number(
      dbInvAlphaAfterPartial?.paymentAllocations.reduce((acc, c) => acc + Number(c.amount), 0)
    );

    recordTest(
      "Section 5",
      "5.1 Partial Allocation: ₹4,000 allocated to ₹10,000 invoice sets status to PARTIALLY_PAID and updates paidAmount",
      resPayPartial.status === 201 &&
        dbInvAlphaAfterPartial?.status === InvoiceStatus.PARTIALLY_PAID &&
        alphaPaidPartial === 4000,
      `Status: ${dbInvAlphaAfterPartial?.status}, paidAmount: ${alphaPaidPartial}`
    );

    // 5.2 Single invoice full payment allocation:
    // Remaining balance of Alpha is ₹6,000. Allocate ₹6,000.
    // Invoice status must transition to PAID.
    const resPayFull = await apiRequest("/api/v1/payments", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        amount: 6000,
        paymentType: PaymentType.FULL,
        paymentMethod: PaymentMethod.UPI,
        paymentDate: new Date().toISOString(),
        transactionReference: "TXN-FULL-6000",
        allocations: [
          {
            invoiceId: invAlpha.id,
            amount: 6000,
          },
        ],
      },
    });
    const payFull = resPayFull.data?.data;
    if (payFull?.id) createdPaymentIds.add(payFull.id);

    const dbInvAlphaAfterFull = await prisma.invoice.findUnique({
      where: { id: invAlpha.id },
      include: { paymentAllocations: true },
    });
    const alphaPaidFull = Number(
      dbInvAlphaAfterFull?.paymentAllocations.reduce((acc, c) => acc + Number(c.amount), 0)
    );

    recordTest(
      "Section 5",
      "5.2 Full Allocation: Additional ₹6,000 payment clears balance and automatically transitions status to PAID",
      resPayFull.status === 201 &&
        dbInvAlphaAfterFull?.status === InvoiceStatus.PAID &&
        alphaPaidFull === 10000,
      `Status: ${dbInvAlphaAfterFull?.status}, paidAmount: ${alphaPaidFull}`
    );

    // 5.3 Over-allocation prevention (Invoice level):
    // Attempting to allocate ₹1,000 to Alpha (which has balance 0) must be rejected with HTTP 400
    const resOverAllocInvoice = await apiRequest("/api/v1/payments", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        amount: 1000,
        paymentMethod: PaymentMethod.CASH,
        paymentDate: new Date().toISOString(),
        allocations: [
          {
            invoiceId: invAlpha.id,
            amount: 1000,
          },
        ],
      },
    });
    recordTest(
      "Section 5",
      "5.3 Over-allocation prevention: Allocation exceeding remaining balance rejected with HTTP 400 BAD_REQUEST",
      resOverAllocInvoice.status === 400,
      `Expected 400, received: ${resOverAllocInvoice.status}`
    );

    // 5.4 Over-allocation prevention (Payment level):
    // Total allocations (₹9,000) > payment amount (₹5,000) must be rejected with HTTP 400
    const resOverAllocPayment = await apiRequest("/api/v1/payments", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        amount: 5000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentDate: new Date().toISOString(),
        allocations: [
          {
            invoiceId: invBeta.id,
            amount: 7000, // exceeds payment amount of 5000
          },
        ],
      },
    });
    recordTest(
      "Section 5",
      "5.4 Over-allocation prevention: Sum of allocations exceeding payment amount rejected with HTTP 400 BAD_REQUEST",
      resOverAllocPayment.status === 400,
      `Expected 400, received: ${resOverAllocPayment.status}`
    );

    // 5.5 Multi-invoice split allocation:
    // Create Invoice Gamma (total ₹5,000).
    // Inv Beta has balance ₹8,000. Inv Gamma has balance ₹5,000.
    // Record single payment of ₹13,000 with allocations: 8,000 to Beta and 5,000 to Gamma.
    // Both must automatically transition to PAID!
    const resInvGamma = await apiRequest("/api/v1/invoices", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Gamma Invoice - DJ & Artist",
        invoiceDate: new Date().toISOString(),
        items: [{ itemName: "Artist Booking", quantity: 1, unitPrice: 5000, type: InvoiceType.FINAL }],
      },
    });
    const invGamma = resInvGamma.data?.data;
    createdInvoiceIds.add(invGamma.id);

    const resMultiAlloc = await apiRequest("/api/v1/payments", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        amount: 13000,
        paymentType: PaymentType.FULL,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentDate: new Date().toISOString(),
        transactionReference: "MULTI-TXN-13000",
        notes: "Lump sum payment clearing Beta and Gamma invoices",
        allocations: [
          {
            invoiceId: invBeta.id,
            amount: 8000,
          },
          {
            invoiceId: invGamma.id,
            amount: 5000,
          },
        ],
      },
    });
    const payMulti = resMultiAlloc.data?.data;
    if (payMulti?.id) createdPaymentIds.add(payMulti.id);

    const dbInvBetaAfter = await prisma.invoice.findUnique({ where: { id: invBeta.id } });
    const dbInvGammaAfter = await prisma.invoice.findUnique({ where: { id: invGamma.id } });

    recordTest(
      "Section 5",
      "5.5 Multi-Invoice Split Allocation: Single ₹13,000 payment splits across two invoices and marks both as PAID",
      resMultiAlloc.status === 201 &&
        dbInvBetaAfter?.status === InvoiceStatus.PAID &&
        dbInvGammaAfter?.status === InvoiceStatus.PAID,
      `Beta Status: ${dbInvBetaAfter?.status}, Gamma Status: ${dbInvGammaAfter?.status}`
    );

    // 5.6 Cannot delete invoice with active payment allocations
    const resDeletePaidInv = await apiRequest(`/api/v1/invoices/${invAlpha.id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 5",
      "5.6 Cannot delete invoice with active payment allocations (rejected with HTTP 400 BAD_REQUEST)",
      resDeletePaidInv.status === 400,
      `Expected 400, received: ${resDeletePaidInv.status}`
    );

    // 5.7 Cannot cancel invoice with active payment allocations
    const resCancelPaidInv = await apiRequest(`/api/v1/invoices/${invAlpha.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: InvoiceStatus.CANCELLED },
    });
    recordTest(
      "Section 5",
      "5.7 Cannot cancel invoice with active payment allocations (rejected with HTTP 400 BAD_REQUEST)",
      resCancelPaidInv.status === 400,
      `Expected 400, received: ${resCancelPaidInv.status}`
    );

    // =========================================================================
    // SECTION 6: Payment Retrieval, IDOR & Reversion / Deletion
    // =========================================================================
    console.log("\n==> SECTION 6: Payment Retrieval, IDOR & Reversion / Deletion");

    // 6.1 Pagination on payments
    const resPayPage = await apiRequest("/api/v1/payments?page=1&limit=2", {
      token: adminToken,
    });
    recordTest(
      "Section 6",
      "6.1 Pagination: GET /api/v1/payments?page=1&limit=2 returns chunk and valid meta attributes",
      resPayPage.status === 200 &&
        resPayPage.data?.data?.length <= 2 &&
        resPayPage.data?.meta?.total >= 3,
      `Status: ${resPayPage.status}, meta: ${JSON.stringify(resPayPage.data?.meta)}`
    );

    // 6.2 Filter by paymentMethod
    const resMethodFilter = await apiRequest("/api/v1/payments?paymentMethod=BANK_TRANSFER", {
      token: adminToken,
    });
    const allBankTransfer = (resMethodFilter.data?.data || []).every(
      (p: any) => p.paymentMethod === PaymentMethod.BANK_TRANSFER
    );
    recordTest(
      "Section 6",
      "6.2 Filter by paymentMethod: ?paymentMethod=BANK_TRANSFER returns only matching payments",
      resMethodFilter.status === 200 && allBankTransfer && resMethodFilter.data?.data?.length > 0,
      `Count: ${resMethodFilter.data?.data?.length}`
    );

    // 6.3 Multi-tenant RBAC: Client A sees ONLY Client A payments
    const resClientAPayments = await apiRequest("/api/v1/payments?limit=100", {
      token: tokenA,
    });
    const paymentsA = resClientAPayments.data?.data || [];
    const paymentsAOnlyHasA = paymentsA.every((p: any) => p.clientId === clientA.id);
    const paymentsALeaksB = paymentsA.some((p: any) => p.clientId === clientB.id);
    recordTest(
      "Section 6",
      "6.3 RBAC Scoping: Client A sees ONLY Client A payments (zero leakage of Client B)",
      resClientAPayments.status === 200 && paymentsAOnlyHasA && !paymentsALeaksB && paymentsA.length >= 3,
      `Count: ${paymentsA.length}, leaks B: ${paymentsALeaksB}`
    );

    // 6.4 IDOR Protection: Client B accessing Client A's payment returns HTTP 403 Forbidden
    const resIdorPayment = await apiRequest(`/api/v1/payments/${pay1.id}`, {
      token: tokenB,
    });
    recordTest(
      "Section 6",
      "6.4 IDOR Protection: Client B accessing Client A payment receives HTTP 403 Forbidden",
      resIdorPayment.status === 403,
      `Expected 403, received: ${resIdorPayment.status}`
    );

    // 6.5 Admin deletes payment and automatically rolls back affected invoice status:
    // Deleting payFull (which allocated ₹6,000 to Alpha) should rollback Alpha's status
    // from PAID back to PARTIALLY_PAID (since ₹4,000 from payPartial still remains)!
    const resDeletePayment = await apiRequest(`/api/v1/payments/${payFull.id}`, {
      method: "DELETE",
      token: adminToken,
    });

    const dbInvAlphaRolledBack = await prisma.invoice.findUnique({
      where: { id: invAlpha.id },
      include: { paymentAllocations: true },
    });
    const rolledBackPaidAmount = Number(
      dbInvAlphaRolledBack?.paymentAllocations.reduce((acc, c) => acc + Number(c.amount), 0)
    );

    recordTest(
      "Section 6",
      "6.5 Payment Deletion & Automatic Rollback: Deleting payment automatically reverts Invoice Alpha from PAID back to PARTIALLY_PAID (Paid: ₹4,000)",
      resDeletePayment.status === 200 &&
        dbInvAlphaRolledBack?.status === InvoiceStatus.PARTIALLY_PAID &&
        rolledBackPaidAmount === 4000,
      `Status: ${dbInvAlphaRolledBack?.status}, paidAmount: ${rolledBackPaidAmount}`
    );
    createdPaymentIds.delete(payFull.id);

    // =========================================================================
    // SECTION 6B: Razorpay Online Payment Gateway Integration
    // =========================================================================
    // 6.6 Razorpay Order Creation: Client A creates order for Invoice Alpha (remaining balance ₹6,000)
    const resRzpOrder = await apiRequest("/api/v1/payments/razorpay/create-order", {
      method: "POST",
      token: tokenA,
      body: {
        invoiceId: invAlpha.id,
      },
    });

    const rzpOrderData = resRzpOrder.data?.data;
    recordTest(
      "Section 6",
      "6.6 Razorpay Gateway: POST /payments/razorpay/create-order generates valid Order (HTTP 201, ₹6,000 = 600000 paise)",
      resRzpOrder.status === 201 &&
        rzpOrderData?.orderId &&
        Number(rzpOrderData?.amount) === 6000 &&
        rzpOrderData?.amountInPaise === 600000 &&
        rzpOrderData?.currency === "INR",
      `Status: ${resRzpOrder.status}, order: ${JSON.stringify(rzpOrderData)}`
    );

    // 6.7 Razorpay Order IDOR Protection: Client A cannot create order for Client B invoice
    const resRzpIdorOrder = await apiRequest("/api/v1/payments/razorpay/create-order", {
      method: "POST",
      token: tokenA,
      body: {
        invoiceId: invB.id,
      },
    });
    recordTest(
      "Section 6",
      "6.7 Razorpay IDOR Protection: Client A creating order for Client B invoice returns HTTP 403 Forbidden",
      resRzpIdorOrder.status === 403,
      `Expected 403, received: ${resRzpIdorOrder.status}`
    );

    // 6.8 Razorpay Order Validation: Amount exceeding remaining balance rejected
    const resRzpExcess = await apiRequest("/api/v1/payments/razorpay/create-order", {
      method: "POST",
      token: tokenA,
      body: {
        invoiceId: invAlpha.id,
        amount: 99999, // Exceeds remaining balance of 6000
      },
    });
    recordTest(
      "Section 6",
      "6.8 Razorpay Validation: Order amount exceeding remaining balance rejected with HTTP 400 BAD_REQUEST",
      resRzpExcess.status === 400,
      `Expected 400, received: ${resRzpExcess.status}`
    );

    // 6.9 Razorpay Tampered Signature Detection: Invalid HMAC rejected
    const resTampered = await apiRequest("/api/v1/payments/razorpay/verify", {
      method: "POST",
      token: tokenA,
      body: {
        invoiceId: invAlpha.id,
        razorpayOrderId: rzpOrderData?.orderId || "order_fake_123",
        razorpayPaymentId: "pay_tampered_fake_456",
        razorpaySignature: "invalid_tampered_cryptographic_signature",
      },
    });
    recordTest(
      "Section 6",
      "6.9 Razorpay Security: Tampered / invalid HMAC signature rejected with HTTP 400 BAD_REQUEST",
      resTampered.status === 400,
      `Expected 400, received: ${resTampered.status}`
    );

    // 6.10 Razorpay Verification & Auto-Settlement: Valid signature verified and settles Invoice Alpha to PAID
    const testPaymentId = `pay_test_${Date.now()}`;
    const validSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "test_secret_placeholder")
      .update(`${rzpOrderData?.orderId}|${testPaymentId}`)
      .digest("hex");

    const resRzpVerify = await apiRequest("/api/v1/payments/razorpay/verify", {
      method: "POST",
      token: tokenA,
      body: {
        invoiceId: invAlpha.id,
        razorpayOrderId: rzpOrderData?.orderId,
        razorpayPaymentId: testPaymentId,
        razorpaySignature: validSignature,
      },
    });

    const settledPayment = resRzpVerify.data?.data?.payment;
    if (settledPayment?.id) createdPaymentIds.add(settledPayment.id);

    const dbInvAlphaFinal = await prisma.invoice.findUnique({
      where: { id: invAlpha.id },
      include: { paymentAllocations: true },
    });
    const finalAlphaPaid = Number(
      dbInvAlphaFinal?.paymentAllocations.reduce((acc, c) => acc + Number(c.amount), 0)
    );

    recordTest(
      "Section 6",
      "6.10 Razorpay Verification & Auto-Settlement: Valid HMAC-SHA256 signature verified, records payment and sets Invoice Alpha to PAID",
      resRzpVerify.status === 200 &&
        settledPayment &&
        settledPayment.transactionReference === testPaymentId &&
        dbInvAlphaFinal?.status === InvoiceStatus.PAID &&
        finalAlphaPaid === 10000,
      `Status: ${resRzpVerify.status}, invoiceStatus: ${dbInvAlphaFinal?.status}, paid: ${finalAlphaPaid}`
    );

    // =========================================================================
    // SECTION 7: Client Sub-Resource Invoices & Payments History
    // =========================================================================
    console.log("\n==> SECTION 7: Client Sub-Resource Invoices & Payments History");

    // 7.1 GET /api/v1/clients/:id/invoices
    const resSubInvoices = await apiRequest(`/api/v1/clients/${clientA.id}/invoices`, {
      token: tokenA,
    });
    const subInvTotal = resSubInvoices.data?.meta?.total ?? resSubInvoices.data?.data?.meta?.total ?? 0;
    recordTest(
      "Section 7",
      "7.1 Sub-Resource: Client retrieves own invoice history via GET /api/v1/clients/:id/invoices",
      resSubInvoices.status === 200 &&
        resSubInvoices.data?.data?.invoices?.length >= 2 &&
        subInvTotal >= 2,
      `Count: ${resSubInvoices.data?.data?.invoices?.length}, Total: ${subInvTotal}`
    );

    // 7.2 GET /api/v1/clients/:id/payments
    const resSubPayments = await apiRequest(`/api/v1/clients/${clientA.id}/payments`, {
      token: tokenA,
    });
    const subPayTotal = resSubPayments.data?.meta?.total ?? resSubPayments.data?.data?.meta?.total ?? 0;
    recordTest(
      "Section 7",
      "7.2 Sub-Resource: Client retrieves own payment history via GET /api/v1/clients/:id/payments",
      resSubPayments.status === 200 &&
        resSubPayments.data?.data?.payments?.length >= 2 &&
        subPayTotal >= 2,
      `Count: ${resSubPayments.data?.data?.payments?.length}, Total: ${subPayTotal}`
    );

    // 7.3 IDOR: Client A accessing Client B sub-resource returns HTTP 403 Forbidden
    const resSubIdor = await apiRequest(`/api/v1/clients/${clientB.id}/invoices`, {
      token: tokenA,
    });
    recordTest(
      "Section 7",
      "7.3 IDOR Protection: Client A accessing Client B sub-resource returns HTTP 403 Forbidden",
      resSubIdor.status === 403,
      `Expected 403, received: ${resSubIdor.status}`
    );

    // =========================================================================
    // SECTION 8: Teardown, Cleanup & Schema Integrity
    // =========================================================================
    console.log("\n==> SECTION 8: Teardown, Cleanup & Schema Integrity");

    // 1. Purge payment allocations & payments
    if (createdPaymentIds.size > 0) {
      await prisma.paymentAllocation.deleteMany({
        where: { paymentId: { in: Array.from(createdPaymentIds) } },
      });
      await prisma.payment.deleteMany({
        where: { id: { in: Array.from(createdPaymentIds) } },
      });
      console.log(`  [Teardown] Purged ${createdPaymentIds.size} test payments & allocations.`);
    }

    // 2. Purge invoice items & invoices
    if (createdInvoiceIds.size > 0) {
      await prisma.paymentAllocation.deleteMany({
        where: { invoiceId: { in: Array.from(createdInvoiceIds) } },
      });
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: { in: Array.from(createdInvoiceIds) } },
      });
      await prisma.invoice.deleteMany({
        where: { id: { in: Array.from(createdInvoiceIds) } },
      });
      console.log(`  [Teardown] Purged ${createdInvoiceIds.size} test invoices & items.`);
    }

    // 3. Purge events
    if (createdEventIds.size > 0) {
      await prisma.event.deleteMany({
        where: { id: { in: Array.from(createdEventIds) } },
      });
      console.log(`  [Teardown] Purged ${createdEventIds.size} test events.`);
    }

    // 4. Purge users
    if (createdUserIds.size > 0) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: Array.from(createdUserIds) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
      console.log(`  [Teardown] Purged ${createdUserIds.size} test users.`);
    }

    // 5. Purge clients
    if (createdClientIds.size > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: Array.from(createdClientIds) } },
      });
      console.log(`  [Teardown] Purged ${createdClientIds.size} test clients.`);
    }

    // Verify 0 orphans
    const orphanInvoices = await prisma.invoice.count({
      where: { id: { in: Array.from(createdInvoiceIds) } },
    });
    const orphanPayments = await prisma.payment.count({
      where: { id: { in: Array.from(createdPaymentIds) } },
    });
    const orphanClients = await prisma.client.count({
      where: { id: { in: Array.from(createdClientIds) } },
    });

    recordTest(
      "Section 8",
      "8.1 Teardown: 0 orphan records remaining across all created test entities",
      orphanInvoices === 0 && orphanPayments === 0 && orphanClients === 0,
      `Orphan invoices: ${orphanInvoices}, payments: ${orphanPayments}, clients: ${orphanClients}`
    );

    // Schema integrity check
    const finalSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    recordTest(
      "Section 8",
      "8.2 Schema integrity: backend/prisma/schema.prisma has NOT been modified (SHA-256 match)",
      finalSchemaHash === initialSchemaHash,
      `Initial: ${initialSchemaHash}, Final: ${finalSchemaHash}`
    );
  } finally {
    if (server) {
      (server as http.Server).close();
      console.log("\n[Test Server] Ephemeral HTTP Server stopped.");
    }
    await prisma.$disconnect();
    console.log("[Test Database] Prisma connection disconnected.");
  }

  // Final Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const totalCount = results.length;
  const successRate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log("\n================================================================================");
  console.log(`       TEST SUMMARY: ${passedCount}/${totalCount} PASSED (${failedCount} FAILED) - Success Rate: ${successRate}%`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    console.error(`\x1b[31m[FAILURE] ${failedCount} tests failed in Phase 6 Test Suite!\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m[SUCCESS] ALL PHASE 6 INVOICES & PAYMENTS TESTS PASSED WITH 100% SUCCESS RATE!\x1b[0m\n`);
    process.exit(0);
  }
}

runPhase6InvoicesAndPaymentsTestSuite().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
