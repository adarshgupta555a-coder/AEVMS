import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import app from "../app.js";
import { prisma, Prisma } from "../lib/prisma.js";
import {
  USERROLE,
  QuotationStatus,
  DiscountType,
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

async function runPhase5QuotationsTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS PHASE 5 QUOTATION MANAGEMENT & PRICING TEST SUITE");
  console.log("================================================================================\n");

  let server: http.Server | null = null;
  let baseUrl = "";
  let initialSchemaHash = "";

  // Tracking sets for comprehensive teardown
  const createdClientIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdQuotationIds = new Set<string>();
  const createdEventIds = new Set<string>();

  // API Request Helper
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

    let res = await fetch(`${baseUrl}${urlPath}`, init);
    if (res.status === 500) {
      await new Promise((r) => setTimeout(r, 600));
      res = await fetch(`${baseUrl}${urlPath}`, init);
    }
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
    // SETUP: Administrator & Test Clients/Users
    // -------------------------------------------------------------------------
    console.log("==> SETUP: Authenticating Administrator");
    let admin = await prisma.user.findFirst({
      where: { role: USERROLE.ADMIN },
    });

    const adminPassword = "Admin@123456";
    if (!admin) {
      const adminPasswordHash = await hashPassword(adminPassword);
      admin = await prisma.user.create({
        data: {
          name: "System Administrator",
          email: "admin@ems.local",
          passwordHash: adminPasswordHash,
          role: USERROLE.ADMIN,
          isActive: true,
          clientId: null,
        },
      });
      console.log(`  [Setup] Created default admin account: ${admin.email}`);
    } else {
      const adminPasswordHash = await hashPassword(adminPassword);
      await prisma.user.update({
        where: { id: admin.id },
        data: { passwordHash: adminPasswordHash, isActive: true },
      });
    }

    const adminLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: admin.email,
        password: adminPassword,
      },
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.data?.data?.accessToken) {
      throw new Error(`Admin login failed with status ${adminLoginRes.status}: ${JSON.stringify(adminLoginRes.data)}`);
    }

    const adminToken = adminLoginRes.data.data.accessToken as string;
    const adminUser = adminLoginRes.data.data.user;
    console.log(`  [Admin Authenticated] ID: ${adminUser.id}, Email: ${adminUser.email}\n`);

    console.log("==> SETUP: Creating Test Clients & Users (Client A, Client B, Standalone User)");
    const clientAPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const clientBPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const uniqueSuffix = Date.now().toString().slice(-6);

    const clientA = await prisma.client.create({
      data: {
        name: `Acme Corp ${uniqueSuffix}`,
        email: `client.a.${uniqueSuffix}@example.com`,
        phone: clientAPhone,
        address: "Tower 1, Cyber City",
        city: "Gurugram",
      },
    });
    createdClientIds.add(clientA.id);

    const clientB = await prisma.client.create({
      data: {
        name: `Beta Industries ${uniqueSuffix}`,
        email: `client.b.${uniqueSuffix}@example.com`,
        phone: clientBPhone,
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

    // Login user A & B
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

    console.log(`  [Setup Complete] Client A (${clientA.id}), Client B (${clientB.id}), Standalone (${standaloneUser.id})\n`);

    // =========================================================================
    // SECTION 1: Quotation Sequencing & Creation
    // =========================================================================
    console.log("==> SECTION 1: Quotation Sequencing & Creation");

    // 1.1 Create Quotation with Percentage Discount (5 items totaling ₹10,000, 10% discount = ₹1,000, tax 18% = ₹1,620, total = ₹10,620)
    const quotePayload1 = {
      clientId: clientA.id,
      title: "Corporate Gala Dinner 2026",
      eventType: "Corporate Dinner",
      eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      venue: "Grand Ballroom, The Oberoi",
      guestCount: 200,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      taxRate: 18,
      notes: "VIP guests requiring valet parking",
      terms: "50% advance required upon acceptance",
      items: [
        {
          itemName: "Premium Buffet Catering",
          description: "4-course buffet with live dessert station",
          quantity: 200,
          unit: "plates",
          unitPrice: 35, // 200 * 35 = 7,000
          sortOrder: 1,
        },
        {
          itemName: "Audio-Visual Setup",
          description: "Dual 4K LED displays, line array speakers, wireless mics",
          quantity: 1,
          unit: "set",
          unitPrice: 2000, // 1 * 2000 = 2,000
          sortOrder: 2,
        },
        {
          itemName: "Stage Lighting & Truss",
          description: "Intelligent moving heads and ambient wash lights",
          quantity: 1,
          unit: "setup",
          unitPrice: 1000, // 1 * 1000 = 1,000
          sortOrder: 3,
        },
      ],
    };

    const resCreateQuote1 = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: quotePayload1,
    });

    const quote1 = resCreateQuote1.data?.data;
    if (quote1?.id) createdQuotationIds.add(quote1.id);

    recordTest(
      "Section 1",
      "1.1 Quotation creation returns HTTP 201 Created with valid payload",
      resCreateQuote1.status === 201 && quote1 && quote1.id,
      `Expected 201, received: ${resCreateQuote1.status}`,
      resCreateQuote1.data
    );

    recordTest(
      "Section 1",
      "1.2 Auto-generated quotationNumber matches sequential format QUO-YYYY-XXXX",
      quote1 && /^QUO-\d{4}-\d{4}$/.test(quote1.quotationNumber),
      `Expected QUO-YYYY-XXXX, received: ${quote1?.quotationNumber}`
    );

    recordTest(
      "Section 1",
      "1.3 Initial default status is strictly DRAFT",
      quote1 && quote1.status === QuotationStatus.DRAFT,
      `Expected DRAFT, received: ${quote1?.status}`
    );

    // 1.4 Precision Decimal Calculations check for Quote 1:
    // Subtotal: 7000 + 2000 + 1000 = 10000
    // Discount: 10% of 10000 = 1000
    // Taxable: 10000 - 1000 = 9000
    // Tax: 18% of 9000 = 1620
    // Total: 9000 + 1620 = 10620
    const subtotalMatches = Number(quote1?.subtotal) === 10000;
    const discountMatches = Number(quote1?.discountValue) === 10 && quote1?.discountType === DiscountType.PERCENTAGE;
    const taxMatches = Number(quote1?.taxRate) === 18 && Number(quote1?.taxAmount) === 1620;
    const totalMatches = Number(quote1?.totalAmount) === 10620;

    recordTest(
      "Section 1",
      "1.4 Accurate Decimal Calculations: Subtotal (₹10,000), 10% Discount (₹1,000), 18% Tax (₹1,620), Total (₹10,620)",
      subtotalMatches && discountMatches && taxMatches && totalMatches,
      `Expected subtotal=10000, taxAmount=1620, total=10620; received: subtotal=${quote1?.subtotal}, taxAmount=${quote1?.taxAmount}, total=${quote1?.totalAmount}`
    );

    recordTest(
      "Section 1",
      "1.5 Populated Client and CreatedBy metadata included in creation response",
      quote1?.client?.id === clientA.id && quote1?.createdBy?.id === adminUser.id,
      `Client ID: ${quote1?.client?.id}, CreatedBy: ${quote1?.createdBy?.id}`
    );

    // 1.6 Sequential increment check: create second quotation
    const quotePayload2 = {
      clientId: clientA.id,
      title: "Product Launch Expo",
      eventType: "Exhibition",
      discountType: DiscountType.FIXED,
      discountValue: 500,
      taxRate: 12,
      items: [
        {
          itemName: "Exhibition Booth Shell Scheme",
          quantity: 10,
          unit: "booths",
          unitPrice: 500, // 10 * 500 = 5000
          sortOrder: 1,
        },
      ],
    };

    const resCreateQuote2 = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: quotePayload2,
    });

    const quote2 = resCreateQuote2.data?.data;
    if (quote2?.id) createdQuotationIds.add(quote2.id);

    const seq1 = parseInt(quote1.quotationNumber.split("-")[2], 10);
    const seq2 = parseInt(quote2.quotationNumber.split("-")[2], 10);

    recordTest(
      "Section 1",
      "1.6 Strict sequential increment: Quotation 2 sequence is exactly Quotation 1 sequence + 1",
      seq2 === seq1 + 1,
      `Expected ${seq1 + 1}, received: ${seq2}`
    );

    // Fixed discount calculation check:
    // Subtotal: 5000
    // Fixed discount: 500
    // Taxable: 4500
    // Tax: 12% of 4500 = 540
    // Total: 4500 + 540 = 5040
    recordTest(
      "Section 1",
      "1.7 Fixed Discount Calculation: Subtotal (₹5,000) - Fixed (₹500) + 12% Tax (₹540) = Total (₹5,040)",
      Number(quote2?.subtotal) === 5000 &&
        Number(quote2?.taxAmount) === 540 &&
        Number(quote2?.totalAmount) === 5040,
      `Received subtotal=${quote2?.subtotal}, taxAmount=${quote2?.taxAmount}, totalAmount=${quote2?.totalAmount}`
    );

    // 1.8 Fixed discount clamping: discount > subtotal is clamped so total doesn't go negative
    const quotePayloadExcessDiscount = {
      clientId: clientA.id,
      title: "Charity Demo Event",
      eventType: "Demo",
      discountType: DiscountType.FIXED,
      discountValue: 99999, // exceeds subtotal of 1000
      taxRate: 18,
      items: [
        {
          itemName: "Microphone rental",
          quantity: 2,
          unitPrice: 500, // 1000
        },
      ],
    };

    const resExcessDiscount = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: quotePayloadExcessDiscount,
    });
    const quoteExcess = resExcessDiscount.data?.data;
    if (quoteExcess?.id) createdQuotationIds.add(quoteExcess.id);

    recordTest(
      "Section 1",
      "1.8 Fixed discount clamping: Discount exceeding subtotal clamps taxable amount to 0 (Total = 0)",
      Number(quoteExcess?.totalAmount) === 0 && Number(quoteExcess?.subtotal) === 1000,
      `Received totalAmount=${quoteExcess?.totalAmount}`
    );

    // 1.9 Validation: Title < 2 characters rejected with HTTP 422
    const resShortTitle = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "X",
        eventType: "Gala",
        items: [{ itemName: "Item 1", quantity: 1, unitPrice: 100 }],
      },
    });
    recordTest(
      "Section 1",
      "1.9 Validation: Title < 2 characters rejected with HTTP 422 VALIDATION_ERROR",
      resShortTitle.status === 422,
      `Expected 422, received: ${resShortTitle.status}`
    );

    // 1.10 Validation: Empty items array rejected with HTTP 422
    const resEmptyItems = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Valid Title",
        eventType: "Gala",
        items: [],
      },
    });
    recordTest(
      "Section 1",
      "1.10 Validation: Empty items array rejected with HTTP 422 VALIDATION_ERROR",
      resEmptyItems.status === 422,
      `Expected 422, received: ${resEmptyItems.status}`
    );

    // 1.11 Validation: Quantity <= 0 rejected with HTTP 422
    const resZeroQuantity = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Valid Title",
        eventType: "Gala",
        items: [{ itemName: "Item 1", quantity: 0, unitPrice: 100 }],
      },
    });
    recordTest(
      "Section 1",
      "1.11 Validation: Quantity <= 0 rejected with HTTP 422 VALIDATION_ERROR",
      resZeroQuantity.status === 422,
      `Expected 422, received: ${resZeroQuantity.status}`
    );

    // 1.12 Validation: Negative unitPrice rejected with HTTP 422
    const resNegativePrice = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Valid Title",
        eventType: "Gala",
        items: [{ itemName: "Item 1", quantity: 1, unitPrice: -50 }],
      },
    });
    recordTest(
      "Section 1",
      "1.12 Validation: Negative unitPrice rejected with HTTP 422 VALIDATION_ERROR",
      resNegativePrice.status === 422,
      `Expected 422, received: ${resNegativePrice.status}`
    );

    // 1.13 Non-existent clientId (RFC 4122 compliant UUID) returns HTTP 404 NOT_FOUND
    const resNonExistentClient = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: "00000000-0000-4000-8000-000000000000",
        title: "Ghost Client Quote",
        eventType: "Seminar",
        items: [{ itemName: "Item 1", quantity: 1, unitPrice: 100 }],
      },
    });
    recordTest(
      "Section 1",
      "1.13 Non-existent clientId returns HTTP 404 NOT_FOUND",
      resNonExistentClient.status === 404 && resNonExistentClient.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resNonExistentClient.status}`
    );

    // 1.14 Security: Client role POST /api/v1/quotations returns HTTP 403 Forbidden
    const resClientCreate = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: tokenA,
      body: {
        clientId: clientA.id,
        title: "Unauthorized Creation Attempt",
        eventType: "Meeting",
        items: [{ itemName: "Unauthorized Item", quantity: 1, unitPrice: 100 }],
      },
    });
    recordTest(
      "Section 1",
      "1.14 Security: Client role POST /api/v1/quotations returns HTTP 403 Forbidden",
      resClientCreate.status === 403,
      `Expected 403, received: ${resClientCreate.status}`
    );

    // 1.15 Security: Unauthenticated POST returns HTTP 401 Unauthorized
    const resUnauthCreate = await apiRequest("/api/v1/quotations", {
      method: "POST",
      body: {
        clientId: clientA.id,
        title: "Unauth Creation Attempt",
        eventType: "Meeting",
        items: [{ itemName: "Item", quantity: 1, unitPrice: 100 }],
      },
    });
    recordTest(
      "Section 1",
      "1.15 Security: Unauthenticated POST /api/v1/quotations returns HTTP 401 Unauthorized",
      resUnauthCreate.status === 401,
      `Expected 401, received: ${resUnauthCreate.status}`
    );

    // 1.16 Quotation for Client B created successfully by Admin
    const resCreateQuoteB = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientB.id,
        title: "Beta Annual Summit 2026",
        eventType: "Conference",
        discountType: null,
        discountValue: 0,
        taxRate: 18,
        items: [
          {
            itemName: "Conference Hall Rental",
            quantity: 3,
            unit: "days",
            unitPrice: 50000,
          },
        ],
      },
    });
    const quoteB = resCreateQuoteB.data?.data;
    if (quoteB?.id) createdQuotationIds.add(quoteB.id);

    recordTest(
      "Section 1",
      "1.16 Quotation for Client B created successfully by Admin (HTTP 201)",
      resCreateQuoteB.status === 201 && quoteB?.clientId === clientB.id,
      `Expected 201, received: ${resCreateQuoteB.status}`
    );

    // =========================================================================
    // SECTION 2: Quotation Retrieval & RBAC Scoping
    // =========================================================================
    console.log("\n==> SECTION 2: Quotation Retrieval & RBAC Scoping");

    // 2.1 Pagination
    const resPage = await apiRequest("/api/v1/quotations?page=1&limit=2", {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.1 Pagination: GET /api/v1/quotations?page=1&limit=2 returns exact chunk and valid meta",
      resPage.status === 200 &&
        resPage.data?.data?.length <= 2 &&
        resPage.data?.meta?.page === 1 &&
        resPage.data?.meta?.limit === 2 &&
        resPage.data?.meta?.total >= 3,
      `Status: ${resPage.status}, meta: ${JSON.stringify(resPage.data?.meta)}`
    );

    // 2.2 Filter by status
    const resStatusFilter = await apiRequest("/api/v1/quotations?status=DRAFT", {
      token: adminToken,
    });
    const allDraft = (resStatusFilter.data?.data || []).every(
      (q: any) => q.status === QuotationStatus.DRAFT
    );
    recordTest(
      "Section 2",
      "2.2 Filter by status: GET /api/v1/quotations?status=DRAFT returns exclusively DRAFT quotations",
      resStatusFilter.status === 200 && allDraft && resStatusFilter.data?.data?.length > 0,
      `Draft check failed, received count: ${resStatusFilter.data?.data?.length}`
    );

    // 2.3 Filter by clientId (Admin)
    const resClientAFilter = await apiRequest(`/api/v1/quotations?clientId=${clientA.id}`, {
      token: adminToken,
    });
    const allClientA = (resClientAFilter.data?.data || []).every(
      (q: any) => q.clientId === clientA.id
    );
    recordTest(
      "Section 2",
      "2.3 Filter by clientId: Admin filter ?clientId=... returns only matching client quotations",
      resClientAFilter.status === 200 && allClientA && resClientAFilter.data?.data?.length >= 2,
      `Count: ${resClientAFilter.data?.data?.length}`
    );

    // 2.4 Search by title keyword
    const resSearch = await apiRequest("/api/v1/quotations?search=Gala", {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.4 Search: GET /api/v1/quotations?search=Gala accurately matches 'Corporate Gala Dinner 2026'",
      resSearch.status === 200 &&
        resSearch.data?.data?.some((q: any) => q.id === quote1.id),
      `Count: ${resSearch.data?.data?.length}`
    );

    // 2.5 Search by quotationNumber
    const resSearchNum = await apiRequest(`/api/v1/quotations?search=${quote1.quotationNumber}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      `2.5 Search: GET /api/v1/quotations?search=${quote1.quotationNumber} accurately matches by quotationNumber`,
      resSearchNum.status === 200 &&
        resSearchNum.data?.data?.length === 1 &&
        resSearchNum.data?.data[0]?.id === quote1.id,
      `Count: ${resSearchNum.data?.data?.length}`
    );

    // 2.6 RBAC: Admin sees quotations across multiple clients
    const resAdminList = await apiRequest("/api/v1/quotations?limit=100", {
      token: adminToken,
    });
    const adminHasA = resAdminList.data?.data?.some((q: any) => q.clientId === clientA.id);
    const adminHasB = resAdminList.data?.data?.some((q: any) => q.clientId === clientB.id);
    recordTest(
      "Section 2",
      "2.6 RBAC Scoping: Admin sees all quotations across Client A and Client B",
      resAdminList.status === 200 && adminHasA && adminHasB,
      `Has Client A: ${adminHasA}, Has Client B: ${adminHasB}`
    );

    // 2.7 RBAC: Client A user sees ONLY Client A quotations (zero leakage of Client B)
    const resClientAList = await apiRequest("/api/v1/quotations?limit=100", {
      token: tokenA,
    });
    const clientAQuotations = resClientAList.data?.data || [];
    const clientAOnlyHasA = clientAQuotations.every((q: any) => q.clientId === clientA.id);
    const clientALeaksB = clientAQuotations.some((q: any) => q.clientId === clientB.id);
    recordTest(
      "Section 2",
      "2.7 RBAC Scoping: Client A user sees ONLY their own quotations (zero leakage of Client B)",
      resClientAList.status === 200 && clientAOnlyHasA && !clientALeaksB && clientAQuotations.length >= 2,
      `Count: ${clientAQuotations.length}, leaks B: ${clientALeaksB}`
    );

    // 2.8 RBAC: Client B user sees ONLY Client B quotations (zero leakage of Client A)
    const resClientBList = await apiRequest("/api/v1/quotations?limit=100", {
      token: tokenB,
    });
    const clientBQuotations = resClientBList.data?.data || [];
    const clientBOnlyHasB = clientBQuotations.every((q: any) => q.clientId === clientB.id);
    const clientBLeaksA = clientBQuotations.some((q: any) => q.clientId === clientA.id);
    recordTest(
      "Section 2",
      "2.8 RBAC Scoping: Client B user sees ONLY their own quotations (zero leakage of Client A)",
      resClientBList.status === 200 && clientBOnlyHasB && !clientBLeaksA && clientBQuotations.length >= 1,
      `Count: ${clientBQuotations.length}, leaks A: ${clientBLeaksA}`
    );

    // 2.9 RBAC: Standalone client user receives empty list
    const resStandaloneList = await apiRequest("/api/v1/quotations", {
      token: tokenStandalone,
    });
    recordTest(
      "Section 2",
      "2.9 RBAC Scoping: Standalone client user (clientId=null) receives empty quotation list (HTTP 200, total=0)",
      resStandaloneList.status === 200 &&
        resStandaloneList.data?.data?.length === 0 &&
        resStandaloneList.data?.meta?.total === 0,
      `Total: ${resStandaloneList.data?.meta?.total}`
    );

    // 2.10 Admin views single quotation details
    const resAdminGet = await apiRequest(`/api/v1/quotations/${quote1.id}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.10 Admin can access single quotation details across any client (HTTP 200)",
      resAdminGet.status === 200 && resAdminGet.data?.data?.id === quote1.id,
      `Status: ${resAdminGet.status}`
    );

    // 2.11 Client user views own quotation
    const resClientGetOwn = await apiRequest(`/api/v1/quotations/${quote1.id}`, {
      token: tokenA,
    });
    recordTest(
      "Section 2",
      "2.11 Client user can access their own quotation details (HTTP 200)",
      resClientGetOwn.status === 200 && resClientGetOwn.data?.data?.id === quote1.id,
      `Status: ${resClientGetOwn.status}`
    );

    // 2.12 IDOR Protection: Client A accessing Client B quotation receives HTTP 403 Forbidden
    const resIdor = await apiRequest(`/api/v1/quotations/${quoteB.id}`, {
      token: tokenA,
    });
    recordTest(
      "Section 2",
      "2.12 IDOR Protection: Client A accessing Client B quotation receives HTTP 403 Forbidden",
      resIdor.status === 403,
      `Expected 403, received: ${resIdor.status}`
    );

    // 2.13 Non-existent quotation ID returns HTTP 404 NOT_FOUND
    const resNonExistent = await apiRequest("/api/v1/quotations/00000000-0000-4000-8000-000000000000", {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.13 Non-existent quotation ID returns HTTP 404 NOT_FOUND",
      resNonExistent.status === 404,
      `Expected 404, received: ${resNonExistent.status}`
    );

    // 2.14 Unauthenticated GET returns HTTP 401 Unauthorized
    const resUnauthGet = await apiRequest(`/api/v1/quotations/${quote1.id}`);
    recordTest(
      "Section 2",
      "2.14 Security: Unauthenticated GET /api/v1/quotations/:id returns HTTP 401 Unauthorized",
      resUnauthGet.status === 401,
      `Expected 401, received: ${resUnauthGet.status}`
    );

    // 2.15 Line item sort order check
    const items = resAdminGet.data?.data?.items || [];
    const isSorted = items.every((item: any, idx: number) => {
      if (idx === 0) return true;
      return item.sortOrder >= items[idx - 1].sortOrder;
    });
    recordTest(
      "Section 2",
      "2.15 Line Items ordering: Items returned strictly ordered by sortOrder asc",
      isSorted && items.length === 3,
      `Items count: ${items.length}, sorted: ${isSorted}`
    );

    // =========================================================================
    // SECTION 3: Quotation State Machine Transitions & Lifecycle Timestamps
    // =========================================================================
    console.log("\n==> SECTION 3: Quotation State Machine Transitions & Lifecycle Timestamps");

    // 3.1 Transition: DRAFT -> SENT sets sentAt timestamp
    const resSendQuote = await apiRequest(`/api/v1/quotations/${quote1.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: QuotationStatus.SENT,
        notes: "Official proposal emailed to client contact",
      },
    });

    const quote1Sent = resSendQuote.data?.data;
    recordTest(
      "Section 3",
      "3.1 Legal State Transition: DRAFT -> SENT returns HTTP 200 OK and sets sentAt timestamp",
      resSendQuote.status === 200 &&
        quote1Sent?.status === QuotationStatus.SENT &&
        quote1Sent?.sentAt !== null,
      `Status: ${quote1Sent?.status}, sentAt: ${quote1Sent?.sentAt}`
    );

    // 3.2 Real-time CRM hook: Client A views SENT quotation -> automatically transitions to VIEWED
    const resClientView = await apiRequest(`/api/v1/quotations/${quote1.id}`, {
      token: tokenA,
    });
    const quote1Viewed = resClientView.data?.data;

    recordTest(
      "Section 3",
      "3.2 Real-time CRM Hook: Client GET /api/v1/quotations/:id on SENT quotation automatically transitions status to VIEWED",
      resClientView.status === 200 && quote1Viewed?.status === QuotationStatus.VIEWED,
      `Expected status VIEWED, received: ${quote1Viewed?.status}`
    );

    // Verify DB reflects VIEWED status
    const dbQuote1 = await prisma.quotation.findUnique({ where: { id: quote1.id } });
    recordTest(
      "Section 3",
      "3.3 Database persistence: Quotation status updated to VIEWED in database",
      dbQuote1?.status === QuotationStatus.VIEWED,
      `DB Status: ${dbQuote1?.status}`
    );

    // 3.4 Client Acceptance: Client A accepts their own quotation
    const resClientAccept = await apiRequest(`/api/v1/quotations/${quote1.id}/status`, {
      method: "PATCH",
      token: tokenA,
      body: {
        status: QuotationStatus.ACCEPTED,
        notes: "Approved proposal and signed terms",
      },
    });

    const quote1Accepted = resClientAccept.data?.data;
    recordTest(
      "Section 3",
      "3.4 Client Acceptance: Client A PATCH /status with ACCEPTED sets status to ACCEPTED and records acceptedAt",
      resClientAccept.status === 200 &&
        quote1Accepted?.status === QuotationStatus.ACCEPTED &&
        quote1Accepted?.acceptedAt !== null,
      `Status: ${quote1Accepted?.status}, acceptedAt: ${quote1Accepted?.acceptedAt}`
    );

    // 3.5 Idempotent transition: ACCEPTED -> ACCEPTED succeeds as no-op
    const resIdempotent = await apiRequest(`/api/v1/quotations/${quote1.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: QuotationStatus.ACCEPTED,
      },
    });
    recordTest(
      "Section 3",
      "3.5 Idempotent Transition: ACCEPTED -> ACCEPTED succeeds as no-op (HTTP 200)",
      resIdempotent.status === 200 && resIdempotent.data?.data?.status === QuotationStatus.ACCEPTED,
      `Status: ${resIdempotent.status}`
    );

    // 3.6 Client Rejection: Test on Quote 2
    // First Admin sends Quote 2
    await apiRequest(`/api/v1/quotations/${quote2.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: QuotationStatus.SENT },
    });

    const resClientReject = await apiRequest(`/api/v1/quotations/${quote2.id}/status`, {
      method: "PATCH",
      token: tokenA,
      body: {
        status: QuotationStatus.REJECTED,
        notes: "Budget constraint for Q4",
      },
    });
    const quote2Rejected = resClientReject.data?.data;

    recordTest(
      "Section 3",
      "3.6 Client Rejection: Client A PATCH /status with REJECTED sets status to REJECTED and records rejectedAt",
      resClientReject.status === 200 &&
        quote2Rejected?.status === QuotationStatus.REJECTED &&
        quote2Rejected?.rejectedAt !== null,
      `Status: ${quote2Rejected?.status}, rejectedAt: ${quote2Rejected?.rejectedAt}`
    );

    // 3.7 Client Illegal transition: Client trying to transition quotation to DRAFT or SENT rejected with HTTP 403 Forbidden
    const resClientIllegalTransition = await apiRequest(`/api/v1/quotations/${quote2.id}/status`, {
      method: "PATCH",
      token: tokenA,
      body: {
        status: QuotationStatus.DRAFT,
      },
    });
    recordTest(
      "Section 3",
      "3.7 Security: Client role trying to transition to DRAFT rejected with HTTP 403 Forbidden",
      resClientIllegalTransition.status === 403,
      `Expected 403, received: ${resClientIllegalTransition.status}`
    );

    // 3.8 Admin Cancellation: Transition to CANCELLED returns HTTP 200
    const resCancelQuote = await apiRequest(`/api/v1/quotations/${quote2.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: QuotationStatus.CANCELLED,
        notes: "Cancelled by admin per client phone call",
      },
    });
    recordTest(
      "Section 3",
      "3.8 Admin Cancellation: REJECTED -> CANCELLED returns HTTP 200 OK",
      resCancelQuote.status === 200 && resCancelQuote.data?.data?.status === QuotationStatus.CANCELLED,
      `Status: ${resCancelQuote.status}`
    );

    // 3.9 Illegal transition: Terminal state CANCELLED -> DRAFT rejected with HTTP 400 BAD_REQUEST
    const resIllegalRollback = await apiRequest(`/api/v1/quotations/${quote2.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: QuotationStatus.DRAFT,
      },
    });
    recordTest(
      "Section 3",
      "3.9 Illegal Transition: Terminal CANCELLED -> DRAFT rejected with HTTP 400 BAD_REQUEST",
      resIllegalRollback.status === 400,
      `Expected 400, received: ${resIllegalRollback.status}`
    );

    // 3.10 Validation: Invalid status enum value rejected with HTTP 422 VALIDATION_ERROR
    const resInvalidEnum = await apiRequest(`/api/v1/quotations/${quote1.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: "INVALID_STATUS_XYZ",
      },
    });
    recordTest(
      "Section 3",
      "3.10 Validation: Invalid status enum value rejected with HTTP 422 VALIDATION_ERROR",
      resInvalidEnum.status === 422,
      `Expected 422, received: ${resInvalidEnum.status}`
    );

    // 3.11 Audit Notes Appending: Notes history recorded with timestamp and role
    const quote1Updated = (await apiRequest(`/api/v1/quotations/${quote1.id}`, { token: adminToken })).data?.data;
    recordTest(
      "Section 3",
      "3.11 Audit trail: Status transition reasons appended to quotation notes",
      quote1Updated?.notes?.includes("Status changed to SENT") &&
        quote1Updated?.notes?.includes("Status changed to ACCEPTED"),
      `Notes content: ${quote1Updated?.notes}`
    );

    // =========================================================================
    // SECTION 4: Quotation Update & Line Item Replacement
    // =========================================================================
    console.log("\n==> SECTION 4: Quotation Update & Line Item Replacement");

    // Create a new DRAFT quotation for update tests
    const resDraftForUpdate = await apiRequest("/api/v1/quotations", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Original Seminar Quotation",
        eventType: "Seminar",
        venue: "Hotel Grand",
        guestCount: 50,
        discountType: DiscountType.FIXED,
        discountValue: 100,
        taxRate: 18,
        items: [
          {
            itemName: "Original Projector",
            quantity: 1,
            unitPrice: 1000,
          },
        ],
      },
    });
    const quoteForUpdate = resDraftForUpdate.data?.data;
    if (quoteForUpdate?.id) createdQuotationIds.add(quoteForUpdate.id);

    // 4.1 Admin updates quotation details and replaces items:
    // New items:
    // Item 1: 2 * 2500 = 5000
    // Item 2: 1 * 5000 = 5000
    // Subtotal: 10000
    // Discount: 15% = 1500
    // Taxable: 8500
    // Tax: 18% = 1530
    // Total: 10030
    const updatePayload = {
      title: "Upgraded Multi-Day Seminar Quotation",
      venue: "Grand Hyatt Conference Center",
      guestCount: 120,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 15,
      taxRate: 18,
      items: [
        {
          itemName: "Dual 4K Projectors",
          quantity: 2,
          unitPrice: 2500,
          sortOrder: 1,
        },
        {
          itemName: "Sound Engineering Crew",
          quantity: 1,
          unitPrice: 5000,
          sortOrder: 2,
        },
      ],
    };

    const resUpdate = await apiRequest(`/api/v1/quotations/${quoteForUpdate.id}`, {
      method: "PUT",
      token: adminToken,
      body: updatePayload,
    });
    const updatedQuote = resUpdate.data?.data;

    recordTest(
      "Section 4",
      "4.1 Admin updates quotation details and replaces line items successfully (HTTP 200)",
      resUpdate.status === 200 &&
        updatedQuote?.title === "Upgraded Multi-Day Seminar Quotation" &&
        updatedQuote?.venue === "Grand Hyatt Conference Center" &&
        updatedQuote?.guestCount === 120,
      `Status: ${resUpdate.status}, title: ${updatedQuote?.title}`
    );

    recordTest(
      "Section 4",
      "4.2 Pricing Recalculation: Subtotal (₹10,000), 15% Discount (₹1,500), 18% Tax (₹1,530), Total (₹10,030)",
      Number(updatedQuote?.subtotal) === 10000 &&
        Number(updatedQuote?.taxAmount) === 1530 &&
        Number(updatedQuote?.totalAmount) === 10030,
      `Received subtotal=${updatedQuote?.subtotal}, taxAmount=${updatedQuote?.taxAmount}, total=${updatedQuote?.totalAmount}`
    );

    recordTest(
      "Section 4",
      "4.3 Database state matches updated properties and new items count (2 items)",
      updatedQuote?.items?.length === 2,
      `Items count: ${updatedQuote?.items?.length}`
    );

    // 4.4 Cannot edit quotation in ACCEPTED status
    const resEditAccepted = await apiRequest(`/api/v1/quotations/${quote1.id}`, {
      method: "PUT",
      token: adminToken,
      body: { title: "Illegal Edit of Accepted Quote" },
    });
    recordTest(
      "Section 4",
      "4.4 Cannot edit quotation in ACCEPTED status (rejected with HTTP 400 BAD_REQUEST)",
      resEditAccepted.status === 400,
      `Expected 400, received: ${resEditAccepted.status}`
    );

    // 4.5 Cannot edit quotation in CANCELLED status
    const resEditCancelled = await apiRequest(`/api/v1/quotations/${quote2.id}`, {
      method: "PUT",
      token: adminToken,
      body: { title: "Illegal Edit of Cancelled Quote" },
    });
    recordTest(
      "Section 4",
      "4.5 Cannot edit quotation in CANCELLED status (rejected with HTTP 400 BAD_REQUEST)",
      resEditCancelled.status === 400,
      `Expected 400, received: ${resEditCancelled.status}`
    );

    // 4.6 Security: Client role PUT /api/v1/quotations/:id returns HTTP 403 Forbidden
    const resClientPut = await apiRequest(`/api/v1/quotations/${quoteForUpdate.id}`, {
      method: "PUT",
      token: tokenA,
      body: { title: "Client Edit Attempt" },
    });
    recordTest(
      "Section 4",
      "4.6 Security: Client role PUT /api/v1/quotations/:id returns HTTP 403 Forbidden",
      resClientPut.status === 403,
      `Expected 403, received: ${resClientPut.status}`
    );

    // 4.7 Non-existent quotation ID on PUT returns HTTP 404 NOT_FOUND
    const resNonExistentPut = await apiRequest("/api/v1/quotations/00000000-0000-4000-8000-000000000000", {
      method: "PUT",
      token: adminToken,
      body: { title: "Ghost Quote" },
    });
    recordTest(
      "Section 4",
      "4.7 Non-existent quotation ID on PUT returns HTTP 404 NOT_FOUND",
      resNonExistentPut.status === 404,
      `Expected 404, received: ${resNonExistentPut.status}`
    );

    // =========================================================================
    // SECTION 5: Quotation to Event Conversion
    // =========================================================================
    console.log("\n==> SECTION 5: Quotation to Event Conversion");

    // 5.1 Admin converts Quote 1 (ACCEPTED) to an Event
    const resConvert = await apiRequest(`/api/v1/quotations/${quote1.id}/convert-to-event`, {
      method: "POST",
      token: adminToken,
      body: {
        venueAddress: "Golf Course Road, DLF Phase 5, Gurugram",
        startTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 18 * 3600 * 1000).toISOString(),
        endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 23 * 3600 * 1000).toISOString(),
        notes: "Executive Gala event created from approved quotation",
      },
    });

    const conversionResult = resConvert.data?.data;
    const convertedEvent = conversionResult?.event;
    if (convertedEvent?.id) createdEventIds.add(convertedEvent.id);

    recordTest(
      "Section 5",
      "5.1 Admin converts quotation to Event via POST /api/v1/quotations/:id/convert-to-event (HTTP 201)",
      resConvert.status === 201 && convertedEvent && convertedEvent.id,
      `Expected 201, received: ${resConvert.status}`
    );

    recordTest(
      "Section 5",
      "5.2 Converted Event has sequential eventNumber (EVT-YYYY-XXXX), status = CONFIRMED, and matching quotationId",
      convertedEvent &&
        /^EVT-\d{4}-\d{4}$/.test(convertedEvent.eventNumber) &&
        convertedEvent.status === EventStatus.CONFIRMED &&
        convertedEvent.quotationId === quote1.id,
      `EventNumber: ${convertedEvent?.eventNumber}, status: ${convertedEvent?.status}, quotationId: ${convertedEvent?.quotationId}`
    );

    recordTest(
      "Section 5",
      "5.3 Event inherits quotation title, client, venue, and total budget (₹10,620)",
      convertedEvent?.clientId === clientA.id &&
        convertedEvent?.title === quote1.title &&
        Number(convertedEvent?.budget) === 10620,
      `ClientId: ${convertedEvent?.clientId}, budget: ${convertedEvent?.budget}`
    );

    // 5.4 Re-conversion prevention: Cannot convert already converted quotation
    const resReconvert = await apiRequest(`/api/v1/quotations/${quote1.id}/convert-to-event`, {
      method: "POST",
      token: adminToken,
      body: {},
    });
    recordTest(
      "Section 5",
      "5.4 Re-conversion prevention: Attempting to convert already converted quotation rejected with HTTP 400 BAD_REQUEST",
      resReconvert.status === 400,
      `Expected 400, received: ${resReconvert.status}`
    );

    // 5.5 Attempting to convert CANCELLED quotation rejected
    const resConvertCancelled = await apiRequest(`/api/v1/quotations/${quote2.id}/convert-to-event`, {
      method: "POST",
      token: adminToken,
      body: {},
    });
    recordTest(
      "Section 5",
      "5.5 Attempting to convert CANCELLED quotation rejected with HTTP 400 BAD_REQUEST",
      resConvertCancelled.status === 400,
      `Expected 400, received: ${resConvertCancelled.status}`
    );

    // 5.6 Security: Client role POST /convert-to-event returns HTTP 403 Forbidden
    const resClientConvert = await apiRequest(`/api/v1/quotations/${quoteForUpdate.id}/convert-to-event`, {
      method: "POST",
      token: tokenA,
      body: {},
    });
    recordTest(
      "Section 5",
      "5.6 Security: Client role POST /convert-to-event returns HTTP 403 Forbidden",
      resClientConvert.status === 403,
      `Expected 403, received: ${resClientConvert.status}`
    );

    // 5.7 Non-existent quotation ID on convert returns HTTP 404 NOT_FOUND
    const resNonExistentConvert = await apiRequest("/api/v1/quotations/00000000-0000-4000-8000-000000000000/convert-to-event", {
      method: "POST",
      token: adminToken,
      body: {},
    });
    recordTest(
      "Section 5",
      "5.7 Non-existent quotation ID on convert returns HTTP 404 NOT_FOUND",
      resNonExistentConvert.status === 404,
      `Expected 404, received: ${resNonExistentConvert.status}`
    );

    // =========================================================================
    // SECTION 6: Quotation Deletion & Constraints
    // =========================================================================
    console.log("\n==> SECTION 6: Quotation Deletion & Constraints");

    // 6.1 Cannot delete quotation linked to an Event
    const resDeleteLinked = await apiRequest(`/api/v1/quotations/${quote1.id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 6",
      "6.1 Cannot delete quotation linked to an existing Event (rejected with HTTP 400 BAD_REQUEST)",
      resDeleteLinked.status === 400,
      `Expected 400, received: ${resDeleteLinked.status}`
    );

    // 6.2 Admin deletes unlinked quotation (quoteForUpdate)
    const quoteForUpdateItemsCount = await prisma.quotationItem.count({
      where: { quotationId: quoteForUpdate.id },
    });

    const resDeleteUnlinked = await apiRequest(`/api/v1/quotations/${quoteForUpdate.id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 6",
      "6.2 Admin deletes quotation not linked to Event/Invoice (HTTP 200 OK)",
      resDeleteUnlinked.status === 200,
      `Expected 200, received: ${resDeleteUnlinked.status}`
    );

    // 6.3 Cascading deletion check: QuotationItem rows purged automatically
    const remainingItems = await prisma.quotationItem.count({
      where: { quotationId: quoteForUpdate.id },
    });
    recordTest(
      "Section 6",
      "6.3 Cascading deletion: QuotationItem rows purged automatically from database (was 2, now 0)",
      quoteForUpdateItemsCount === 2 && remainingItems === 0,
      `Previous: ${quoteForUpdateItemsCount}, remaining: ${remainingItems}`
    );

    // 6.4 Quotation confirmed purged from DB
    const dbDeletedQuote = await prisma.quotation.findUnique({
      where: { id: quoteForUpdate.id },
    });
    recordTest(
      "Section 6",
      "6.4 Quotation confirmed purged from database",
      dbDeletedQuote === null,
      `Found: ${JSON.stringify(dbDeletedQuote)}`
    );
    createdQuotationIds.delete(quoteForUpdate.id);

    // 6.5 Deleting already purged / non-existent quotation returns HTTP 404 NOT_FOUND
    const resDelete404 = await apiRequest(`/api/v1/quotations/${quoteForUpdate.id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 6",
      "6.5 Deleting already purged / non-existent quotation returns HTTP 404 NOT_FOUND",
      resDelete404.status === 404,
      `Expected 404, received: ${resDelete404.status}`
    );

    // 6.6 Security: Client role DELETE /api/v1/quotations/:id returns HTTP 403 Forbidden
    const resClientDelete = await apiRequest(`/api/v1/quotations/${quote2.id}`, {
      method: "DELETE",
      token: tokenA,
    });
    recordTest(
      "Section 6",
      "6.6 Security: Client role DELETE /api/v1/quotations/:id returns HTTP 403 Forbidden",
      resClientDelete.status === 403,
      `Expected 403, received: ${resClientDelete.status}`
    );

    // =========================================================================
    // SECTION 7: Client Sub-Resource Quotation History
    // =========================================================================
    console.log("\n==> SECTION 7: Client Sub-Resource Quotation History");

    // 7.1 GET /api/v1/clients/:id/quotations returns client's quotation list
    const resSubresourceClientA = await apiRequest(`/api/v1/clients/${clientA.id}/quotations`, {
      token: tokenA,
    });
    recordTest(
      "Section 7",
      "7.1 GET /api/v1/clients/:id/quotations: Client retrieves their own quotation history with pagination meta",
      resSubresourceClientA.status === 200 &&
        resSubresourceClientA.data?.data?.quotations?.length >= 2 &&
        ((resSubresourceClientA.data?.meta?.total ?? 0) >= 2 ||
          (resSubresourceClientA.data?.data?.meta?.total ?? 0) >= 2),
      `Count: ${resSubresourceClientA.data?.data?.quotations?.length}, Meta: ${JSON.stringify(resSubresourceClientA.data?.meta)}`
    );

    // 7.2 GET /api/v1/admin/clients/:id/quotations returns history for Admin
    const resSubresourceAdmin = await apiRequest(`/api/v1/admin/clients/${clientA.id}/quotations`, {
      token: adminToken,
    });
    recordTest(
      "Section 7",
      "7.2 GET /api/v1/admin/clients/:id/quotations: Admin retrieves client's quotation history",
      resSubresourceAdmin.status === 200 &&
        resSubresourceAdmin.data?.data?.quotations?.length >= 2,
      `Count: ${resSubresourceAdmin.data?.data?.quotations?.length}`
    );

    // 7.3 Status filter on sub-resource history
    const resSubresourceStatus = await apiRequest(`/api/v1/clients/${clientA.id}/quotations?status=ACCEPTED`, {
      token: tokenA,
    });
    recordTest(
      "Section 7",
      "7.3 Status filtering in sub-resource history: ?status=ACCEPTED returns only ACCEPTED quotations",
      resSubresourceStatus.status === 200 &&
        resSubresourceStatus.data?.data?.quotations?.every((q: any) => q.status === QuotationStatus.ACCEPTED),
      `Quotations: ${JSON.stringify(resSubresourceStatus.data?.data?.quotations?.map((q: any) => q.status))}`
    );

    // 7.4 Client accessing other client's quotation history returns HTTP 403 Forbidden
    const resSubresourceIdor = await apiRequest(`/api/v1/clients/${clientB.id}/quotations`, {
      token: tokenA,
    });
    recordTest(
      "Section 7",
      "7.4 IDOR Protection: Client A accessing Client B quotation history returns HTTP 403 Forbidden",
      resSubresourceIdor.status === 403,
      `Expected 403, received: ${resSubresourceIdor.status}`
    );

    // =========================================================================
    // SECTION 8: Teardown, Cleanup & Schema Integrity
    // =========================================================================
    console.log("\n==> SECTION 8: Teardown, Cleanup & Schema Integrity");

    // Cleanup events first (due to quotation link)
    if (createdEventIds.size > 0) {
      await prisma.event.deleteMany({
        where: { id: { in: Array.from(createdEventIds) } },
      });
      console.log(`  [Teardown] Purged ${createdEventIds.size} test events.`);
    }

    // Cleanup quotations (cascades to items)
    if (createdQuotationIds.size > 0) {
      await prisma.quotation.deleteMany({
        where: { id: { in: Array.from(createdQuotationIds) } },
      });
      console.log(`  [Teardown] Purged ${createdQuotationIds.size} test quotations.`);
    }

    // Cleanup refresh tokens & users
    if (createdUserIds.size > 0) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: Array.from(createdUserIds) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
      console.log(`  [Teardown] Purged ${createdUserIds.size} test users.`);
    }

    // Cleanup clients
    if (createdClientIds.size > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: Array.from(createdClientIds) } },
      });
      console.log(`  [Teardown] Purged ${createdClientIds.size} test clients.`);
    }

    // Verify 0 orphans
    const orphanQuotes = await prisma.quotation.count({
      where: { id: { in: Array.from(createdQuotationIds) } },
    });
    const orphanEvents = await prisma.event.count({
      where: { id: { in: Array.from(createdEventIds) } },
    });
    const orphanUsers = await prisma.user.count({
      where: { id: { in: Array.from(createdUserIds) } },
    });

    recordTest(
      "Section 8",
      "8.1 Teardown: 0 orphan records remaining across all created test entities",
      orphanQuotes === 0 && orphanEvents === 0 && orphanUsers === 0,
      `Orphan quotes: ${orphanQuotes}, events: ${orphanEvents}, users: ${orphanUsers}`
    );

    // Verify schema integrity
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
    console.error(`\x1b[31m[FAILURE] ${failedCount} tests failed in Phase 5 Quotation Test Suite!\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m[SUCCESS] ALL PHASE 5 QUOTATION & PRICING TESTS PASSED WITH 100% SUCCESS RATE!\x1b[0m\n`);
    process.exit(0);
  }
}

runPhase5QuotationsTestSuite().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
