import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import app from "../app.js";
import { prisma, Prisma } from "../lib/prisma.js";
import {
  USERROLE,
  EventStatus,
  TaskStatus,
  TaskPriority,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  ExpenseScope,
  ExpenseCategory,
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

async function runPhase4EventsTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS PHASE 4 EVENT MANAGEMENT & LIFECYCLE QUALITY & SECURITY TEST SUITE");
  console.log("================================================================================\n");

  let server: http.Server | null = null;
  let baseUrl = "";
  let initialSchemaHash = "";

  // Tracking sets for comprehensive teardown
  const createdClientIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdEventIds = new Set<string>();
  const createdTaskIds = new Set<string>();
  const createdScheduleIds = new Set<string>();
  const createdInvoiceIds = new Set<string>();
  const createdPaymentIds = new Set<string>();
  const createdExpenseIds = new Set<string>();

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

    const res = await fetch(`${baseUrl}${urlPath}`, init);
    let data: any = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return {
      status: res.status,
      data,
      headers: res.headers,
    };
  }

  try {
    // -------------------------------------------------------------------------
    // Record schema.prisma hash for untouched schema integrity verification
    // -------------------------------------------------------------------------
    initialSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    console.log(`[Schema Check] Initial prisma/schema.prisma SHA-256: ${initialSchemaHash}`);

    // -------------------------------------------------------------------------
    // Start In-Memory HTTP Server on ephemeral port
    // -------------------------------------------------------------------------
    await new Promise<void>((resolve, reject) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const addr = server!.address();
        if (typeof addr === "object" && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
          console.log(`[Test Server] Ephemeral HTTP Server listening on ${baseUrl}\n`);
          resolve();
        } else {
          reject(new Error("Failed to obtain server address"));
        }
      });
    });

    // -------------------------------------------------------------------------
    // SETUP: Authenticating Administrator
    // -------------------------------------------------------------------------
    console.log("==> SETUP: Authenticating Administrator");

    let admin = await prisma.user.findFirst({
      where: { role: USERROLE.ADMIN },
    });

    if (!admin) {
      const adminPasswordHash = await hashPassword("Admin@123456");
      admin = await prisma.user.create({
        data: {
          name: "System Administrator",
          email: "admin@ems.local",
          passwordHash: adminPasswordHash,
          role: USERROLE.ADMIN,
          isActive: true,
        },
      });
    }

    const adminLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: "admin@ems.local",
        password: "Admin@123456",
      },
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.data?.data?.accessToken) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }

    const adminToken: string = adminLoginRes.data.data.accessToken;
    console.log(`  [Admin Authenticated] ID: ${admin.id}, Email: ${admin.email}`);

    // -------------------------------------------------------------------------
    // SETUP: Creating Test Clients & Client User Actors (Client A & Client B)
    // -------------------------------------------------------------------------
    console.log("\n==> SETUP: Creating Test Clients & Users (Client A, Client B, Standalone User)");

    const clientTimestamp = Date.now();

    // Client A
    const clientA = await prisma.client.create({
      data: {
        name: `Alpha Corp ${clientTimestamp}`,
        phone: `98765${String(clientTimestamp).slice(-5)}`,
        email: `alpha_${clientTimestamp}@test.local`,
        city: "Mumbai",
        address: "Alpha Towers, BKC",
      },
    });
    createdClientIds.add(clientA.id);

    const clientAUserPasswordHash = await hashPassword("ClientA@123456");
    const clientAUser = await prisma.user.create({
      data: {
        name: `Alpha Client User ${clientTimestamp}`,
        email: `alpha_user_${clientTimestamp}@test.local`,
        passwordHash: clientAUserPasswordHash,
        role: USERROLE.CLIENT,
        isActive: true,
        clientId: clientA.id,
      },
    });
    createdUserIds.add(clientAUser.id);

    const clientALoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: clientAUser.email,
        password: "ClientA@123456",
      },
    });
    const clientAToken: string = clientALoginRes.data.data.accessToken;

    // Client B
    const clientB = await prisma.client.create({
      data: {
        name: `Beta Industries ${clientTimestamp}`,
        phone: `98764${String(clientTimestamp).slice(-5)}`,
        email: `beta_${clientTimestamp}@test.local`,
        city: "Delhi",
        address: "Beta Tech Park, Connaught Place",
      },
    });
    createdClientIds.add(clientB.id);

    const clientBUserPasswordHash = await hashPassword("ClientB@123456");
    const clientBUser = await prisma.user.create({
      data: {
        name: `Beta Client User ${clientTimestamp}`,
        email: `beta_user_${clientTimestamp}@test.local`,
        passwordHash: clientBUserPasswordHash,
        role: USERROLE.CLIENT,
        isActive: true,
        clientId: clientB.id,
      },
    });
    createdUserIds.add(clientBUser.id);

    const clientBLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: clientBUser.email,
        password: "ClientB@123456",
      },
    });
    const clientBToken: string = clientBLoginRes.data.data.accessToken;

    // Standalone Client User without clientId
    const standaloneUser = await prisma.user.create({
      data: {
        name: `Standalone User ${clientTimestamp}`,
        email: `standalone_${clientTimestamp}@test.local`,
        passwordHash: await hashPassword("Standalone@123456"),
        role: USERROLE.CLIENT,
        isActive: true,
        clientId: null,
      },
    });
    createdUserIds.add(standaloneUser.id);

    const standaloneLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: standaloneUser.email,
        password: "Standalone@123456",
      },
    });
    const standaloneToken: string = standaloneLoginRes.data.data.accessToken;

    console.log(`  [Setup Complete] Client A (${clientA.id}), Client B (${clientB.id}), Standalone User (${standaloneUser.id})`);

    // =========================================================================
    // SECTION 1: EVENT NUMBER SEQUENCING & CREATION
    // =========================================================================
    console.log("\n==> SECTION 1: Event Number Sequencing & Creation");

    let event1Id = "";
    let event1Number = "";
    let event2Id = "";
    let event2Number = "";

    // 1.1 Create Event 1 (EVT-YYYY-XXXX format & DRAFT status)
    const eventDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
    const startTime1 = new Date(eventDate1.getTime());
    startTime1.setUTCHours(10, 0, 0, 0);
    const endTime1 = new Date(eventDate1.getTime());
    endTime1.setUTCHours(18, 0, 0, 0);

    const createEvt1Payload = {
      clientId: clientA.id,
      title: "Annual Leadership Summit 2026",
      eventType: "Corporate Conference",
      description: "Annual executive keynote and networking dinner",
      eventDate: eventDate1.toISOString(),
      startTime: startTime1.toISOString(),
      endTime: endTime1.toISOString(),
      venueName: "Grand Ballroom, The Taj Mahal Palace",
      venueAddress: "Apollo Bunder, Colaba, Mumbai",
      guestCount: 250,
      budget: 150000.0,
      notes: "VIP guests require executive protocol",
    };

    const resCreate1 = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: createEvt1Payload,
    });

    const isEvt1Success = resCreate1.status === 201 && resCreate1.data?.data?.id;
    if (isEvt1Success) {
      event1Id = resCreate1.data.data.id;
      event1Number = resCreate1.data.data.eventNumber;
      createdEventIds.add(event1Id);
    }

    recordTest(
      "Section 1",
      "1.1.1 Event creation returns HTTP 201 Created with valid payload",
      isEvt1Success,
      `Expected status 201, received: ${resCreate1.status}`,
      resCreate1.data
    );

    const currentYear = new Date().getFullYear();
    const evtNumberRegex = new RegExp(`^EVT-${currentYear}-\\d{4}$`);
    recordTest(
      "Section 1",
      `1.1.2 Auto-generated eventNumber matches sequential format EVT-${currentYear}-XXXX (got: ${event1Number})`,
      evtNumberRegex.test(event1Number),
      `Event number '${event1Number}' does not match expected format ^EVT-${currentYear}-\\d{4}$`
    );

    recordTest(
      "Section 1",
      "1.1.3 Default initial status is strictly DRAFT",
      resCreate1.data?.data?.status === EventStatus.DRAFT,
      `Expected status DRAFT, got: ${resCreate1.data?.data?.status}`
    );

    recordTest(
      "Section 1",
      "1.1.4 Populated client metadata present in creation response (id, name, email, phone)",
      resCreate1.data?.data?.client?.id === clientA.id &&
        resCreate1.data?.data?.client?.name === clientA.name &&
        Boolean(resCreate1.data?.data?.client?.email),
      "Client metadata missing or mismatch in response",
      resCreate1.data?.data?.client
    );

    recordTest(
      "Section 1",
      "1.1.5 Populated createdBy metadata present in creation response (id, name, email, role)",
      resCreate1.data?.data?.createdBy?.id === admin.id &&
        resCreate1.data?.data?.createdBy?.role === USERROLE.ADMIN,
      "CreatedBy metadata missing or mismatch in response",
      resCreate1.data?.data?.createdBy
    );

    recordTest(
      "Section 1",
      "1.1.6 Initial count metadata initialized (_count for tasks, schedules, invoice, payments, calendar)",
      resCreate1.data?.data?._count !== undefined &&
        resCreate1.data.data._count.tasks === 0 &&
        resCreate1.data.data._count.schedules === 0,
      "_count metadata missing or incorrect",
      resCreate1.data?.data?._count
    );

    // 1.2 Create Event 2 to verify strict sequential incrementation
    const eventDate2 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const resCreate2 = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Product Launch Gala 2026",
        eventType: "Product Launch",
        eventDate: eventDate2.toISOString(),
        budget: 75000,
      },
    });

    if (resCreate2.status === 201 && resCreate2.data?.data?.id) {
      event2Id = resCreate2.data.data.id;
      event2Number = resCreate2.data.data.eventNumber;
      createdEventIds.add(event2Id);
    }

    const seq1 = parseInt(event1Number.split("-")[2] || "0", 10);
    const seq2 = parseInt(event2Number.split("-")[2] || "0", 10);
    recordTest(
      "Section 1",
      `1.2 Strict sequential increment: Event 2 sequence (${seq2}) is exactly Event 1 sequence (${seq1}) + 1`,
      seq2 === seq1 + 1,
      `Expected ${seq1 + 1}, received: ${seq2}`
    );

    // 1.3 Validation: title min 3 chars
    const resShortTitle = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "AB", // Only 2 chars
        eventType: "Conference",
        eventDate: eventDate1.toISOString(),
      },
    });
    recordTest(
      "Section 1",
      "1.3 Validation: Title < 3 characters rejected with HTTP 422 VALIDATION_ERROR",
      resShortTitle.status === 422 && resShortTitle.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resShortTitle.status}`,
      resShortTitle.data
    );

    // 1.4 Validation: budget cannot be negative
    const resNegativeBudget = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Negative Budget Event",
        eventType: "Seminar",
        eventDate: eventDate1.toISOString(),
        budget: -500,
      },
    });
    recordTest(
      "Section 1",
      "1.4 Validation: Budget < 0 rejected with HTTP 422 VALIDATION_ERROR",
      resNegativeBudget.status === 422 && resNegativeBudget.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resNegativeBudget.status}`,
      resNegativeBudget.data
    );

    // 1.5 Validation: endTime earlier than startTime
    const resInvalidDates = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Invalid Timeline Event",
        eventType: "Workshop",
        eventDate: eventDate1.toISOString(),
        startTime: "2026-12-15T18:00:00Z",
        endTime: "2026-12-15T12:00:00Z", // Earlier than startTime
      },
    });
    recordTest(
      "Section 1",
      "1.5 Validation: endTime < startTime rejected with HTTP 422 VALIDATION_ERROR",
      resInvalidDates.status === 422 && resInvalidDates.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resInvalidDates.status}`,
      resInvalidDates.data
    );

    // 1.6 Validation: missing required fields (clientId, title, eventType, eventDate)
    const resMissingFields = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        description: "Missing mandatory fields",
      },
    });
    recordTest(
      "Section 1",
      "1.6 Validation: Missing mandatory fields rejected with HTTP 422 VALIDATION_ERROR",
      resMissingFields.status === 422,
      `Expected 422, received: ${resMissingFields.status}`,
      resMissingFields.data
    );

    // 1.7 Non-existent clientId returns HTTP 404 NOT_FOUND
    const nonExistentClientId = "00000000-0000-4000-8000-000000000000";
    const resNonExistentClient = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: nonExistentClientId,
        title: "Orphan Event Attempt",
        eventType: "Seminar",
        eventDate: eventDate1.toISOString(),
      },
    });
    recordTest(
      "Section 1",
      "1.7 Non-existent clientId returns HTTP 404 NOT_FOUND",
      resNonExistentClient.status === 404 && resNonExistentClient.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resNonExistentClient.status}`,
      resNonExistentClient.data
    );

    // 1.8 Admin-only creation: Client role receives HTTP 403 Forbidden
    const resClientRoleCreate = await apiRequest("/api/v1/events", {
      method: "POST",
      token: clientAToken,
      body: {
        clientId: clientA.id,
        title: "Client Unauthorized Event",
        eventType: "Party",
        eventDate: eventDate1.toISOString(),
      },
    });
    recordTest(
      "Section 1",
      "1.8 Security: Client role POST /api/v1/events returns HTTP 403 Forbidden",
      resClientRoleCreate.status === 403 && resClientRoleCreate.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientRoleCreate.status}`,
      resClientRoleCreate.data
    );

    // 1.9 Unauthenticated creation returns HTTP 401 Unauthorized
    const resUnauthCreate = await apiRequest("/api/v1/events", {
      method: "POST",
      body: {
        clientId: clientA.id,
        title: "Unauthenticated Event",
        eventType: "Party",
        eventDate: eventDate1.toISOString(),
      },
    });
    recordTest(
      "Section 1",
      "1.9 Security: Unauthenticated POST /api/v1/events returns HTTP 401 Unauthorized",
      resUnauthCreate.status === 401 && resUnauthCreate.data?.error?.code === "UNAUTHORIZED",
      `Expected 401, received: ${resUnauthCreate.status}`,
      resUnauthCreate.data
    );

    // Create Event 3 for Client B (to test RBAC scoping)
    const resCreateClientBEvent = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientB.id,
        title: "Beta Tech Expo 2026",
        eventType: "Exhibition",
        venueName: "Pragati Maidan Hall 5",
        eventDate: eventDate1.toISOString(),
        budget: 200000,
      },
    });
    let eventClientBId = "";
    if (resCreateClientBEvent.status === 201 && resCreateClientBEvent.data?.data?.id) {
      eventClientBId = resCreateClientBEvent.data.data.id;
      createdEventIds.add(eventClientBId);
    }
    recordTest(
      "Section 1",
      "1.10 Event for Client B created successfully by Admin (HTTP 201)",
      resCreateClientBEvent.status === 201 && Boolean(eventClientBId),
      `Expected 201, received: ${resCreateClientBEvent.status}`
    );

    // =========================================================================
    // SECTION 2: EVENT RETRIEVAL & RBAC SCOPING
    // =========================================================================
    console.log("\n==> SECTION 2: Event Retrieval & RBAC Scoping");

    // 2.1 Admin lists events with pagination
    const resPagination = await apiRequest("/api/v1/events?page=1&limit=2", {
      token: adminToken,
    });
    const hasPaginationMeta =
      resPagination.status === 200 &&
      resPagination.data?.meta?.page === 1 &&
      resPagination.data?.meta?.limit === 2 &&
      resPagination.data?.meta?.total >= 3 &&
      resPagination.data?.meta?.totalPages >= 2 &&
      Array.isArray(resPagination.data?.data) &&
      resPagination.data.data.length === 2;
    recordTest(
      "Section 2",
      "2.1 Pagination: GET /api/v1/events?page=1&limit=2 returns exact chunk and valid meta attributes",
      hasPaginationMeta,
      `Expected 2 items with valid meta, got status: ${resPagination.status}`,
      resPagination.data?.meta
    );

    // 2.2 Filter by status
    const resStatusFilter = await apiRequest("/api/v1/events?status=DRAFT", {
      token: adminToken,
    });
    const allDraft =
      resStatusFilter.status === 200 &&
      Array.isArray(resStatusFilter.data?.data) &&
      resStatusFilter.data.data.length > 0 &&
      resStatusFilter.data.data.every((e: any) => e.status === EventStatus.DRAFT);
    recordTest(
      "Section 2",
      "2.2 Filter by status: GET /api/v1/events?status=DRAFT returns exclusively DRAFT events",
      allDraft,
      `Expected only DRAFT events, got status: ${resStatusFilter.status}`
    );

    // 2.3 Filter by search keyword
    const resSearch = await apiRequest("/api/v1/events?search=Summit", {
      token: adminToken,
    });
    const searchMatch =
      resSearch.status === 200 &&
      Array.isArray(resSearch.data?.data) &&
      resSearch.data.data.some((e: any) => e.id === event1Id);
    recordTest(
      "Section 2",
      "2.3 Search: GET /api/v1/events?search=Summit accurately matches 'Annual Leadership Summit 2026'",
      searchMatch,
      `Search did not return target event ${event1Id}`
    );

    // Search by eventNumber
    const resSearchNumber = await apiRequest(`/api/v1/events?search=${event1Number}`, {
      token: adminToken,
    });
    const numberMatch =
      resSearchNumber.status === 200 &&
      Array.isArray(resSearchNumber.data?.data) &&
      resSearchNumber.data.data.some((e: any) => e.eventNumber === event1Number);
    recordTest(
      "Section 2",
      `2.4 Search: GET /api/v1/events?search=${event1Number} accurately matches by eventNumber`,
      numberMatch,
      `Search did not return event with eventNumber ${event1Number}`
    );

    // 2.5 Filter by date range (from, to)
    const fromDate = new Date(eventDate1.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date(eventDate1.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const resDateFilter = await apiRequest(`/api/v1/events?from=${fromDate}&to=${toDate}`, {
      token: adminToken,
    });
    const dateMatch =
      resDateFilter.status === 200 &&
      Array.isArray(resDateFilter.data?.data) &&
      resDateFilter.data.data.some((e: any) => e.id === event1Id);
    recordTest(
      "Section 2",
      "2.5 Date range filter: GET /api/v1/events?from=...&to=... filters events correctly",
      dateMatch,
      `Date filter did not match expected event, status: ${resDateFilter.status}`
    );

    // 2.6 RBAC Scoping: Admin sees all events across tenants
    const resAdminAll = await apiRequest("/api/v1/events?limit=100", {
      token: adminToken,
    });
    const adminSeesBoth =
      resAdminAll.status === 200 &&
      Array.isArray(resAdminAll.data?.data) &&
      resAdminAll.data.data.some((e: any) => e.clientId === clientA.id) &&
      resAdminAll.data.data.some((e: any) => e.clientId === clientB.id);
    recordTest(
      "Section 2",
      "2.6 RBAC Scoping: Admin sees all events across multiple clients (Client A and Client B)",
      adminSeesBoth,
      "Admin view missing events from one or more clients"
    );

    // 2.7 RBAC Scoping: Client A sees ONLY their own events
    const resClientAEvents = await apiRequest("/api/v1/events?limit=100", {
      token: clientAToken,
    });
    const clientAIsIsolated =
      resClientAEvents.status === 200 &&
      Array.isArray(resClientAEvents.data?.data) &&
      resClientAEvents.data.data.length > 0 &&
      resClientAEvents.data.data.every((e: any) => e.clientId === clientA.id) &&
      !resClientAEvents.data.data.some((e: any) => e.clientId === clientB.id);
    recordTest(
      "Section 2",
      "2.7 RBAC Scoping: Client A user sees ONLY their own events (zero leakage of Client B events)",
      clientAIsIsolated,
      "Client A was able to see foreign client events or received empty list"
    );

    // 2.8 RBAC Scoping: Client B sees ONLY their own events
    const resClientBEvents = await apiRequest("/api/v1/events?limit=100", {
      token: clientBToken,
    });
    const clientBIsIsolated =
      resClientBEvents.status === 200 &&
      Array.isArray(resClientBEvents.data?.data) &&
      resClientBEvents.data.data.length > 0 &&
      resClientBEvents.data.data.every((e: any) => e.clientId === clientB.id) &&
      !resClientBEvents.data.data.some((e: any) => e.clientId === clientA.id);
    recordTest(
      "Section 2",
      "2.8 RBAC Scoping: Client B user sees ONLY their own events (zero leakage of Client A events)",
      clientBIsIsolated,
      "Client B was able to see foreign client events or received empty list"
    );

    // 2.9 RBAC Scoping: Standalone user without clientId gets empty list
    const resStandaloneEvents = await apiRequest("/api/v1/events", {
      token: standaloneToken,
    });
    const standaloneEmpty =
      resStandaloneEvents.status === 200 &&
      Array.isArray(resStandaloneEvents.data?.data) &&
      resStandaloneEvents.data.data.length === 0 &&
      resStandaloneEvents.data?.meta?.total === 0;
    recordTest(
      "Section 2",
      "2.9 RBAC Scoping: Standalone client user (clientId=null) receives empty event list (HTTP 200, total=0)",
      standaloneEmpty,
      `Expected empty array, got: ${JSON.stringify(resStandaloneEvents.data)}`
    );

    // 2.10 GET /api/v1/events/:id: Admin can access any event
    const resAdminGetClientA = await apiRequest(`/api/v1/events/${event1Id}`, {
      token: adminToken,
    });
    const resAdminGetClientB = await apiRequest(`/api/v1/events/${eventClientBId}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.10 Admin can access single event details across any client (HTTP 200)",
      resAdminGetClientA.status === 200 &&
        resAdminGetClientB.status === 200 &&
        resAdminGetClientA.data?.data?.id === event1Id &&
        resAdminGetClientB.data?.data?.id === eventClientBId,
      `Expected 200, got: clientA=${resAdminGetClientA.status}, clientB=${resAdminGetClientB.status}`
    );

    // 2.11 GET /api/v1/events/:id: Client can access own event
    const resClientGetOwn = await apiRequest(`/api/v1/events/${event1Id}`, {
      token: clientAToken,
    });
    recordTest(
      "Section 2",
      "2.11 Client user can access their own event details (HTTP 200)",
      resClientGetOwn.status === 200 && resClientGetOwn.data?.data?.id === event1Id,
      `Expected 200, got: ${resClientGetOwn.status}`
    );

    // 2.12 IDOR Protection: Client accessing another client's event receives HTTP 403 Forbidden
    const resClientAIdorOnB = await apiRequest(`/api/v1/events/${eventClientBId}`, {
      token: clientAToken,
    });
    recordTest(
      "Section 2",
      "2.12 IDOR Protection: Client A accessing Client B's event receives HTTP 403 Forbidden",
      resClientAIdorOnB.status === 403 && resClientAIdorOnB.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientAIdorOnB.status}`,
      resClientAIdorOnB.data
    );

    // 2.13 Non-existent event ID returns HTTP 404 NOT_FOUND
    const nonExistentEventId = crypto.randomUUID();
    const resNonExistentEvent = await apiRequest(`/api/v1/events/${nonExistentEventId}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.13 Non-existent event ID returns HTTP 404 NOT_FOUND",
      resNonExistentEvent.status === 404 && resNonExistentEvent.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resNonExistentEvent.status}`
    );

    // 2.14 Unauthenticated single event retrieval returns HTTP 401 Unauthorized
    const resUnauthGetEvent = await apiRequest(`/api/v1/events/${event1Id}`);
    recordTest(
      "Section 2",
      "2.14 Security: Unauthenticated GET /api/v1/events/:id returns HTTP 401 Unauthorized",
      resUnauthGetEvent.status === 401 && resUnauthGetEvent.data?.error?.code === "UNAUTHORIZED",
      `Expected 401, received: ${resUnauthGetEvent.status}`
    );

    // =========================================================================
    // SECTION 3: EVENT STATE MACHINE TRANSITIONS
    // =========================================================================
    console.log("\n==> SECTION 3: Event State Machine Transitions");

    // 3.1 Legal Flow Step 1: DRAFT -> CONFIRMED (HTTP 200) with Audit Logging
    const resDraftToConfirmed = await apiRequest(`/api/v1/events/${event1Id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: EventStatus.CONFIRMED,
        reason: "Client advance deposit received and venue agreement signed",
      },
    });
    const isConfirmed =
      resDraftToConfirmed.status === 200 &&
      resDraftToConfirmed.data?.data?.status === EventStatus.CONFIRMED;
    recordTest(
      "Section 3",
      "3.1 Legal State Transition: DRAFT -> CONFIRMED returns HTTP 200 OK",
      isConfirmed,
      `Expected 200 with status CONFIRMED, got: ${resDraftToConfirmed.status}`
    );

    // 3.2 Status transition audit logging: reason is appended into notes
    const confirmedNotes: string = resDraftToConfirmed.data?.data?.notes || "";
    const hasAuditLog =
      confirmedNotes.includes("Status transitioned from DRAFT to CONFIRMED") &&
      confirmedNotes.includes("Client advance deposit received and venue agreement signed");
    recordTest(
      "Section 3",
      "3.2 Status transition audit logging: Timestamped reason text appended to notes",
      hasAuditLog,
      `Expected audit log in notes, got: '${confirmedNotes}'`
    );

    // 3.3 Legal Flow Step 2: CONFIRMED -> PLANNING (HTTP 200)
    const resConfirmedToPlanning = await apiRequest(`/api/v1/events/${event1Id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: EventStatus.PLANNING,
        reason: "Operational planning and vendor procurement initiated",
      },
    });
    recordTest(
      "Section 3",
      "3.3 Legal State Transition: CONFIRMED -> PLANNING returns HTTP 200 OK",
      resConfirmedToPlanning.status === 200 &&
        resConfirmedToPlanning.data?.data?.status === EventStatus.PLANNING,
      `Expected 200 with status PLANNING, got: ${resConfirmedToPlanning.status}`
    );

    // 3.4 Legal Flow Step 3: PLANNING -> IN_PROGRESS (HTTP 200)
    const resPlanningToInProgress = await apiRequest(`/api/v1/events/${event1Id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: EventStatus.IN_PROGRESS,
        reason: "Event execution commenced on site",
      },
    });
    recordTest(
      "Section 3",
      "3.4 Legal State Transition: PLANNING -> IN_PROGRESS returns HTTP 200 OK",
      resPlanningToInProgress.status === 200 &&
        resPlanningToInProgress.data?.data?.status === EventStatus.IN_PROGRESS,
      `Expected 200 with status IN_PROGRESS, got: ${resPlanningToInProgress.status}`
    );

    // 3.5 Legal Flow Step 4: IN_PROGRESS -> COMPLETED (HTTP 200)
    const resInProgressToCompleted = await apiRequest(`/api/v1/events/${event1Id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: EventStatus.COMPLETED,
        reason: "Event concluded successfully and debrief wrapped up",
      },
    });
    recordTest(
      "Section 3",
      "3.5 Legal State Transition: IN_PROGRESS -> COMPLETED returns HTTP 200 OK",
      resInProgressToCompleted.status === 200 &&
        resInProgressToCompleted.data?.data?.status === EventStatus.COMPLETED,
      `Expected 200 with status COMPLETED, got: ${resInProgressToCompleted.status}`
    );

    // 3.6 Idempotent Same-Status Transition (COMPLETED -> COMPLETED)
    const resIdempotent = await apiRequest(`/api/v1/events/${event1Id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: EventStatus.COMPLETED,
      },
    });
    recordTest(
      "Section 3",
      "3.6 Idempotent Transition: Same status transition (COMPLETED -> COMPLETED) succeeds as no-op (HTTP 200)",
      resIdempotent.status === 200 && resIdempotent.data?.data?.status === EventStatus.COMPLETED,
      `Expected 200, got: ${resIdempotent.status}`
    );

    // 3.7 Cancellation from various states (DRAFT -> CANCELLED, CONFIRMED -> CANCELLED, PLANNING -> CANCELLED)
    // 3.7a Cancel from DRAFT
    const resCancelDraft = await apiRequest(`/api/v1/events/${event2Id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: EventStatus.CANCELLED,
        reason: "Client postponed product launch to next fiscal year",
      },
    });
    recordTest(
      "Section 3",
      "3.7a Cancellation: DRAFT -> CANCELLED returns HTTP 200 OK",
      resCancelDraft.status === 200 && resCancelDraft.data?.data?.status === EventStatus.CANCELLED,
      `Expected 200, got: ${resCancelDraft.status}`
    );

    // Create a fresh event for CONFIRMED -> CANCELLED test
    const resFreshEvt = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Temporary Test Event for State Machine",
        eventType: "Seminar",
        eventDate: eventDate1.toISOString(),
      },
    });
    const freshEvtId = resFreshEvt.data?.data?.id;
    if (freshEvtId) createdEventIds.add(freshEvtId);

    // Move to CONFIRMED
    await apiRequest(`/api/v1/events/${freshEvtId}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: EventStatus.CONFIRMED },
    });

    // 3.7b Cancel from CONFIRMED
    const resCancelConfirmed = await apiRequest(`/api/v1/events/${freshEvtId}/status`, {
      method: "PATCH",
      token: adminToken,
      body: {
        status: EventStatus.CANCELLED,
        reason: "Force majeure cancellation",
      },
    });
    recordTest(
      "Section 3",
      "3.7b Cancellation: CONFIRMED -> CANCELLED returns HTTP 200 OK",
      resCancelConfirmed.status === 200 &&
        resCancelConfirmed.data?.data?.status === EventStatus.CANCELLED,
      `Expected 200, got: ${resCancelConfirmed.status}`
    );

    // 3.8 Illegal Transition: DRAFT -> COMPLETED (HTTP 400 Bad Request)
    const resCreateDraftIllegal = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Illegal Flow Test Event",
        eventType: "Workshop",
        eventDate: eventDate1.toISOString(),
      },
    });
    const illegalEvtId = resCreateDraftIllegal.data?.data?.id;
    if (illegalEvtId) createdEventIds.add(illegalEvtId);

    const resDraftToCompleted = await apiRequest(`/api/v1/events/${illegalEvtId}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: EventStatus.COMPLETED },
    });
    recordTest(
      "Section 3",
      "3.8 Illegal Transition: DRAFT -> COMPLETED rejected with HTTP 400 BAD_REQUEST",
      resDraftToCompleted.status === 400 &&
        resDraftToCompleted.data?.error?.code === "BAD_REQUEST",
      `Expected 400, received: ${resDraftToCompleted.status}`,
      resDraftToCompleted.data
    );

    // Move illegalEvtId to CONFIRMED
    await apiRequest(`/api/v1/events/${illegalEvtId}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: EventStatus.CONFIRMED },
    });

    // 3.9 Illegal Transition: CONFIRMED -> DRAFT (HTTP 400 Bad Request)
    const resConfirmedToDraft = await apiRequest(`/api/v1/events/${illegalEvtId}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: EventStatus.DRAFT },
    });
    recordTest(
      "Section 3",
      "3.9 Illegal Transition: CONFIRMED -> DRAFT (regressive rollback) rejected with HTTP 400 BAD_REQUEST",
      resConfirmedToDraft.status === 400 &&
        resConfirmedToDraft.data?.error?.code === "BAD_REQUEST",
      `Expected 400, received: ${resConfirmedToDraft.status}`,
      resConfirmedToDraft.data
    );

    // 3.10 Illegal Transition: COMPLETED -> PLANNING (HTTP 400 Bad Request - terminal state)
    const resCompletedToPlanning = await apiRequest(`/api/v1/events/${event1Id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: EventStatus.PLANNING },
    });
    recordTest(
      "Section 3",
      "3.10 Illegal Transition: Terminal state COMPLETED -> PLANNING rejected with HTTP 400 BAD_REQUEST",
      resCompletedToPlanning.status === 400 &&
        resCompletedToPlanning.data?.error?.code === "BAD_REQUEST",
      `Expected 400, received: ${resCompletedToPlanning.status}`,
      resCompletedToPlanning.data
    );

    // 3.11 Illegal Transition: CANCELLED -> DRAFT (HTTP 400 Bad Request - terminal state)
    const resCancelledToDraft = await apiRequest(`/api/v1/events/${event2Id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: EventStatus.DRAFT },
    });
    recordTest(
      "Section 3",
      "3.11 Illegal Transition: Terminal state CANCELLED -> DRAFT rejected with HTTP 400 BAD_REQUEST",
      resCancelledToDraft.status === 400 &&
        resCancelledToDraft.data?.error?.code === "BAD_REQUEST",
      `Expected 400, received: ${resCancelledToDraft.status}`,
      resCancelledToDraft.data
    );

    // 3.12 Invalid status enum value returns HTTP 422 VALIDATION_ERROR
    const resInvalidStatusEnum = await apiRequest(`/api/v1/events/${illegalEvtId}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "NON_EXISTENT_STATUS" },
    });
    recordTest(
      "Section 3",
      "3.12 Validation: Invalid status enum value rejected with HTTP 422 VALIDATION_ERROR",
      resInvalidStatusEnum.status === 422 &&
        resInvalidStatusEnum.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resInvalidStatusEnum.status}`
    );

    // 3.13 Security: Client role cannot transition status (HTTP 403 Forbidden)
    const resClientPatchStatus = await apiRequest(`/api/v1/events/${event1Id}/status`, {
      method: "PATCH",
      token: clientAToken,
      body: { status: EventStatus.CONFIRMED },
    });
    recordTest(
      "Section 3",
      "3.13 Security: Client role PATCH /api/v1/events/:id/status returns HTTP 403 Forbidden",
      resClientPatchStatus.status === 403 &&
        resClientPatchStatus.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientPatchStatus.status}`
    );

    // 3.14 Security: Unauthenticated caller receives HTTP 401 Unauthorized
    const resUnauthPatchStatus = await apiRequest(`/api/v1/events/${event1Id}/status`, {
      method: "PATCH",
      body: { status: EventStatus.CONFIRMED },
    });
    recordTest(
      "Section 3",
      "3.14 Security: Unauthenticated PATCH /api/v1/events/:id/status returns HTTP 401 Unauthorized",
      resUnauthPatchStatus.status === 401 &&
        resUnauthPatchStatus.data?.error?.code === "UNAUTHORIZED",
      `Expected 401, received: ${resUnauthPatchStatus.status}`
    );

    // =========================================================================
    // SECTION 4: EVENT UPDATE & DELETION
    // =========================================================================
    console.log("\n==> SECTION 4: Event Update & Deletion");

    // Create a dedicated event for update and delete tests
    const resEvtForUpdate = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Original Event Title",
        eventType: "Seminar",
        eventDate: eventDate1.toISOString(),
        venueName: "Original Venue",
        guestCount: 100,
        budget: 50000,
      },
    });
    const updateEventId = resEvtForUpdate.data?.data?.id;
    if (updateEventId) createdEventIds.add(updateEventId);

    // 4.1 Admin updates event details (PUT /api/v1/events/:id)
    const updatedDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    const resUpdate = await apiRequest(`/api/v1/events/${updateEventId}`, {
      method: "PUT",
      token: adminToken,
      body: {
        title: "Updated Leadership Conclave 2026",
        venueName: "Regal Pavilion, Marine Drive",
        venueAddress: "Marine Drive, Churchgate, Mumbai",
        guestCount: 350,
        budget: 180000,
        eventDate: updatedDate.toISOString(),
        notes: "Updated executive catering requirements",
      },
    });

    const isUpdatedOk =
      resUpdate.status === 200 &&
      resUpdate.data?.data?.title === "Updated Leadership Conclave 2026" &&
      resUpdate.data?.data?.venueName === "Regal Pavilion, Marine Drive" &&
      resUpdate.data?.data?.guestCount === 350 &&
      Number(resUpdate.data?.data?.budget) === 180000;

    recordTest(
      "Section 4",
      "4.1 Admin updates event title, venue, guestCount, budget & notes successfully (HTTP 200)",
      isUpdatedOk,
      `Expected updated values, got: ${resUpdate.status}`,
      resUpdate.data?.data
    );

    // DB confirmation of update
    const dbEventUpdated = await prisma.event.findUnique({ where: { id: updateEventId } });
    recordTest(
      "Section 4",
      "4.2 Database state matches updated event properties",
      dbEventUpdated?.title === "Updated Leadership Conclave 2026" &&
        Number(dbEventUpdated?.budget) === 180000,
      "Database values do not match update payload"
    );

    // 4.3 Validation: update with endTime < startTime returns HTTP 422
    const resUpdateInvalidDates = await apiRequest(`/api/v1/events/${updateEventId}`, {
      method: "PUT",
      token: adminToken,
      body: {
        startTime: "2026-12-25T18:00:00Z",
        endTime: "2026-12-25T10:00:00Z",
      },
    });
    recordTest(
      "Section 4",
      "4.3 Validation: Update with endTime < startTime rejected with HTTP 422 VALIDATION_ERROR",
      resUpdateInvalidDates.status === 422 &&
        resUpdateInvalidDates.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resUpdateInvalidDates.status}`
    );

    // 4.4 Validation: update with budget < 0 returns HTTP 422
    const resUpdateNegativeBudget = await apiRequest(`/api/v1/events/${updateEventId}`, {
      method: "PUT",
      token: adminToken,
      body: {
        budget: -100,
      },
    });
    recordTest(
      "Section 4",
      "4.4 Validation: Update with budget < 0 rejected with HTTP 422 VALIDATION_ERROR",
      resUpdateNegativeBudget.status === 422 &&
        resUpdateNegativeBudget.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resUpdateNegativeBudget.status}`
    );

    // 4.5 Security: Client role PUT /api/v1/events/:id returns HTTP 403 Forbidden
    const resClientUpdate = await apiRequest(`/api/v1/events/${updateEventId}`, {
      method: "PUT",
      token: clientAToken,
      body: {
        title: "Malicious Client Modification",
      },
    });
    recordTest(
      "Section 4",
      "4.5 Security: Client role PUT /api/v1/events/:id returns HTTP 403 Forbidden",
      resClientUpdate.status === 403 && resClientUpdate.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientUpdate.status}`
    );

    // 4.6 Non-existent ID on PUT returns HTTP 404 NOT_FOUND
    const resUpdateNonExistent = await apiRequest(`/api/v1/events/${nonExistentEventId}`, {
      method: "PUT",
      token: adminToken,
      body: { title: "Non-existent Event" },
    });
    recordTest(
      "Section 4",
      "4.6 Non-existent event ID on PUT returns HTTP 404 NOT_FOUND",
      resUpdateNonExistent.status === 404 &&
        resUpdateNonExistent.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resUpdateNonExistent.status}`
    );

    // 4.7 Financial link deletion protection:
    // Create an event with a linked invoice, payment, and expense, and verify DELETE is blocked!
    const resEvtWithFin = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Event With Financial Records",
        eventType: "Gala",
        eventDate: eventDate1.toISOString(),
        budget: 100000,
      },
    });
    const finEvtId = resEvtWithFin.data?.data?.id;
    if (finEvtId) createdEventIds.add(finEvtId);

    // Create an invoice linked to finEvtId
    const linkedInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-TEST-${Date.now()}`,
        clientId: clientA.id,
        eventId: finEvtId,
        title: "Deposit Invoice for Fin Event",
        invoiceDate: new Date(),
        subtotal: new Prisma.Decimal(25000),
        totalAmount: new Prisma.Decimal(25000),
        status: InvoiceStatus.SENT,
        createdById: admin.id,
      },
    });
    createdInvoiceIds.add(linkedInvoice.id);

    // Attempt to DELETE event with linked invoice -> HTTP 400 Bad Request
    const resDeleteWithInvoice = await apiRequest(`/api/v1/events/${finEvtId}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 4",
      "4.7 Financial Integrity: DELETE event with active invoice rejected with HTTP 400 BAD_REQUEST",
      resDeleteWithInvoice.status === 400 &&
        resDeleteWithInvoice.data?.error?.code === "BAD_REQUEST" &&
        resDeleteWithInvoice.data?.error?.message?.includes("Cannot delete event with linked invoices"),
      `Expected 400 with linked invoice message, got: ${resDeleteWithInvoice.status}`,
      resDeleteWithInvoice.data
    );

    // Event still exists in database
    const dbEventStillExists = await prisma.event.findUnique({ where: { id: finEvtId } });
    recordTest(
      "Section 4",
      "4.8 Event remains intact in database after rejected delete attempt",
      dbEventStillExists !== null,
      "Event was unexpectedly deleted despite active invoice!"
    );

    // 4.9 Admin deletes event without financial links -> HTTP 200 OK
    // Attach task and schedule to updateEventId to verify cascading deletion
    const dummyTask = await prisma.eventTask.create({
      data: {
        eventId: updateEventId,
        title: "Cascading Delete Test Task",
        priority: TaskPriority.LOW,
        status: TaskStatus.TODO,
      },
    });
    createdTaskIds.add(dummyTask.id);

    const dummySchedule = await prisma.eventSchedule.create({
      data: {
        eventId: updateEventId,
        title: "Cascading Delete Test Schedule",
        startAt: new Date(),
      },
    });
    createdScheduleIds.add(dummySchedule.id);

    const resDeleteClean = await apiRequest(`/api/v1/events/${updateEventId}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 4",
      "4.9 Admin deletes event without financial links returns HTTP 200 OK",
      resDeleteClean.status === 200,
      `Expected 200, received: ${resDeleteClean.status}`
    );

    // 4.10 Confirmed deleted from database
    const dbDeletedEvt = await prisma.event.findUnique({ where: { id: updateEventId } });
    recordTest(
      "Section 4",
      "4.10 Event confirmed purged from database",
      dbDeletedEvt === null,
      "Event still present in DB after deletion"
    );

    // 4.11 Cascading cleanup: tasks and schedules deleted
    const dbCascadedTask = await prisma.eventTask.findUnique({ where: { id: dummyTask.id } });
    const dbCascadedSchedule = await prisma.eventSchedule.findUnique({
      where: { id: dummySchedule.id },
    });
    recordTest(
      "Section 4",
      "4.11 Cascading cleanup: Child tasks and schedules purged automatically on event deletion",
      dbCascadedTask === null && dbCascadedSchedule === null,
      "Orphan tasks or schedules remained in DB after event deletion"
    );

    // 4.12 Security: Client role DELETE returns HTTP 403 Forbidden
    const resClientDelete = await apiRequest(`/api/v1/events/${event1Id}`, {
      method: "DELETE",
      token: clientAToken,
    });
    recordTest(
      "Section 4",
      "4.12 Security: Client role DELETE /api/v1/events/:id returns HTTP 403 Forbidden",
      resClientDelete.status === 403 && resClientDelete.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientDelete.status}`
    );

    // 4.13 DELETE non-existent / already deleted event returns HTTP 404 NOT_FOUND
    const resDeleteNotFound = await apiRequest(`/api/v1/events/${updateEventId}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 4",
      "4.13 Deleting already purged / non-existent event returns HTTP 404 NOT_FOUND",
      resDeleteNotFound.status === 404 && resDeleteNotFound.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resDeleteNotFound.status}`
    );

    // =========================================================================
    // SECTION 5: EVENT FINANCIAL SUMMARY
    // =========================================================================
    console.log("\n==> SECTION 5: Event Financial Summary");

    // Create an event specifically for financial calculations
    const resFinEvt = await apiRequest("/api/v1/events", {
      method: "POST",
      token: adminToken,
      body: {
        clientId: clientA.id,
        title: "Grand Financial Gala 2026",
        eventType: "Gala",
        eventDate: eventDate1.toISOString(),
        budget: 80000,
      },
    });
    const summaryEventId = resFinEvt.data?.data?.id;
    if (summaryEventId) createdEventIds.add(summaryEventId);

    // Seed Financial Records:
    // 1. Invoice: 50,000
    const summaryInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-SUMMARY-${Date.now()}`,
        clientId: clientA.id,
        eventId: summaryEventId,
        title: "Stage & Production Services",
        invoiceDate: new Date(),
        subtotal: new Prisma.Decimal(50000),
        totalAmount: new Prisma.Decimal(50000),
        status: InvoiceStatus.SENT,
        createdById: admin.id,
      },
    });
    createdInvoiceIds.add(summaryInvoice.id);

    // 2. Payment: 30,000 (COMPLETED)
    const summaryPayment = await prisma.payment.create({
      data: {
        paymentNumber: `PAY-SUMMARY-${Date.now()}`,
        clientId: clientA.id,
        eventId: summaryEventId,
        amount: new Prisma.Decimal(30000),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date(),
        recordedById: admin.id,
      },
    });
    createdPaymentIds.add(summaryPayment.id);

    // 3. Expense: 12,000 (EVENT scope)
    const summaryExpense = await prisma.expense.create({
      data: {
        title: "Audio Visual Vendor Rental",
        amount: new Prisma.Decimal(12000),
        scope: ExpenseScope.EVENT,
        category: ExpenseCategory.OTHER_OPERATING,
        eventId: summaryEventId,
        expenseDate: new Date(),
        createdById: admin.id,
      },
    });
    createdExpenseIds.add(summaryExpense.id);

    // 5.1 Admin GET /api/v1/events/:id/summary
    const resSummary = await apiRequest(`/api/v1/events/${summaryEventId}/summary`, {
      token: adminToken,
    });
    const finData = resSummary.data?.data?.financials;
    const isSummaryCorrect =
      resSummary.status === 200 &&
      finData?.budget === 80000 &&
      finData?.totalInvoiced === 50000 &&
      finData?.totalPaid === 30000 &&
      finData?.totalExpenses === 12000 &&
      finData?.balanceReceivable === 20000 && // 50000 - 30000
      finData?.profitMargin === 38000; // 50000 - 12000

    recordTest(
      "Section 5",
      "5.1 Admin retrieves accurate financial summary { budget: 80k, invoiced: 50k, paid: 30k, balance: 20k, expenses: 12k, margin: 38k }",
      isSummaryCorrect,
      `Summary calculations incorrect or status not 200: ${resSummary.status}`,
      finData
    );

    recordTest(
      "Section 5",
      "5.2 Summary response includes counts metadata (invoice, payments, expense)",
      resSummary.data?.data?.counts?.invoice >= 1 &&
        resSummary.data?.data?.counts?.payments >= 1 &&
        resSummary.data?.data?.counts?.expense >= 1,
      "Counts metadata missing or inaccurate",
      resSummary.data?.data?.counts
    );

    // 5.3 Security: Client role GET /api/v1/events/:id/summary returns HTTP 403 Forbidden
    const resClientSummary = await apiRequest(`/api/v1/events/${summaryEventId}/summary`, {
      token: clientAToken,
    });
    recordTest(
      "Section 5",
      "5.3 Security: Client role GET /api/v1/events/:id/summary returns HTTP 403 Forbidden",
      resClientSummary.status === 403 && resClientSummary.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientSummary.status}`
    );

    // 5.4 Security: Unauthenticated GET summary returns HTTP 401 Unauthorized
    const resUnauthSummary = await apiRequest(`/api/v1/events/${summaryEventId}/summary`);
    recordTest(
      "Section 5",
      "5.4 Security: Unauthenticated GET /api/v1/events/:id/summary returns HTTP 401 Unauthorized",
      resUnauthSummary.status === 401 && resUnauthSummary.data?.error?.code === "UNAUTHORIZED",
      `Expected 401, received: ${resUnauthSummary.status}`
    );

    // 5.5 Non-existent event ID on summary returns HTTP 404 NOT_FOUND
    const resSummaryNotFound = await apiRequest(`/api/v1/events/${nonExistentEventId}/summary`, {
      token: adminToken,
    });
    recordTest(
      "Section 5",
      "5.5 Non-existent event ID on summary returns HTTP 404 NOT_FOUND",
      resSummaryNotFound.status === 404 && resSummaryNotFound.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resSummaryNotFound.status}`
    );

    // =========================================================================
    // SECTION 6: OPERATIONAL TASKS SUB-RESOURCE
    // =========================================================================
    console.log("\n==> SECTION 6: Operational Tasks Sub-resource");

    let testTaskId = "";

    // 6.1 Admin creates task: POST /api/v1/events/:eventId/tasks
    const taskDueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const resCreateTask = await apiRequest(`/api/v1/events/${event1Id}/tasks`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "Finalize Executive Catering Menu",
        description: "Arrange tasting session with Taj Head Chef",
        dueDate: taskDueDate.toISOString(),
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
      },
    });

    const isTaskCreated =
      resCreateTask.status === 201 &&
      resCreateTask.data?.data?.id &&
      resCreateTask.data?.data?.title === "Finalize Executive Catering Menu" &&
      resCreateTask.data?.data?.priority === TaskPriority.HIGH &&
      resCreateTask.data?.data?.status === TaskStatus.TODO &&
      resCreateTask.data?.data?.completedAt === null;

    if (isTaskCreated) {
      testTaskId = resCreateTask.data.data.id;
      createdTaskIds.add(testTaskId);
    }

    recordTest(
      "Section 6",
      "6.1 Admin creates operational task: POST /api/v1/events/:eventId/tasks returns HTTP 201 Created",
      isTaskCreated,
      `Expected 201, received: ${resCreateTask.status}`,
      resCreateTask.data
    );

    // 6.2 Validation: task title min 2 chars
    const resShortTaskTitle = await apiRequest(`/api/v1/events/${event1Id}/tasks`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "A", // 1 char
        priority: TaskPriority.MEDIUM,
      },
    });
    recordTest(
      "Section 6",
      "6.2 Validation: Task title < 2 characters rejected with HTTP 422 VALIDATION_ERROR",
      resShortTaskTitle.status === 422 &&
        resShortTaskTitle.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resShortTaskTitle.status}`
    );

    // 6.3 Non-existent eventId on task creation returns HTTP 404 NOT_FOUND
    const resTaskNonExistentEvent = await apiRequest(`/api/v1/events/${nonExistentEventId}/tasks`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "Orphan Task Attempt",
        priority: TaskPriority.LOW,
      },
    });
    recordTest(
      "Section 6",
      "6.3 Non-existent eventId on task creation returns HTTP 404 NOT_FOUND",
      resTaskNonExistentEvent.status === 404 &&
        resTaskNonExistentEvent.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resTaskNonExistentEvent.status}`
    );

    // 6.4 Security: Client role POST task returns HTTP 403 Forbidden
    const resClientCreateTask = await apiRequest(`/api/v1/events/${event1Id}/tasks`, {
      method: "POST",
      token: clientAToken,
      body: {
        title: "Unauthorized Client Task",
      },
    });
    recordTest(
      "Section 6",
      "6.4 Security: Client role POST /api/v1/events/:eventId/tasks returns HTTP 403 Forbidden",
      resClientCreateTask.status === 403 &&
        resClientCreateTask.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientCreateTask.status}`
    );

    // 6.5 Security: Unauthenticated POST task returns HTTP 401 Unauthorized
    const resUnauthCreateTask = await apiRequest(`/api/v1/events/${event1Id}/tasks`, {
      method: "POST",
      body: {
        title: "Unauthenticated Task",
      },
    });
    recordTest(
      "Section 6",
      "6.5 Security: Unauthenticated POST task returns HTTP 401 Unauthorized",
      resUnauthCreateTask.status === 401 &&
        resUnauthCreateTask.data?.error?.code === "UNAUTHORIZED",
      `Expected 401, received: ${resUnauthCreateTask.status}`
    );

    // 6.6 List Tasks: GET /api/v1/events/:eventId/tasks
    const resListTasksAdmin = await apiRequest(`/api/v1/events/${event1Id}/tasks`, {
      token: adminToken,
    });
    const hasCreatedTask =
      resListTasksAdmin.status === 200 &&
      Array.isArray(resListTasksAdmin.data?.data) &&
      resListTasksAdmin.data.data.some((t: any) => t.id === testTaskId);
    recordTest(
      "Section 6",
      "6.6 Admin lists event tasks: GET /api/v1/events/:eventId/tasks returns HTTP 200 OK with tasks",
      hasCreatedTask,
      `Expected task ${testTaskId} in list, got: ${resListTasksAdmin.status}`
    );

    // Client lists tasks for their own event (allowed read access)
    const resListTasksClient = await apiRequest(`/api/v1/events/${event1Id}/tasks`, {
      token: clientAToken,
    });
    recordTest(
      "Section 6",
      "6.7 Client retrieves operational tasks for own event (HTTP 200 OK)",
      resListTasksClient.status === 200 && Array.isArray(resListTasksClient.data?.data),
      `Expected 200, got: ${resListTasksClient.status}`
    );

    // 6.8 Update Task: PUT /api/v1/events/tasks/:taskId to COMPLETED
    // Verify completedAt timestamp is updated!
    const resUpdateTaskCompleted = await apiRequest(`/api/v1/events/tasks/${testTaskId}`, {
      method: "PUT",
      token: adminToken,
      body: {
        status: TaskStatus.COMPLETED,
        description: "Menu finalized and approved by executive committee",
      },
    });
    const taskCompletedAt = resUpdateTaskCompleted.data?.data?.completedAt;
    const isCompletedAtValid =
      resUpdateTaskCompleted.status === 200 &&
      resUpdateTaskCompleted.data?.data?.status === TaskStatus.COMPLETED &&
      taskCompletedAt !== null &&
      !isNaN(Date.parse(taskCompletedAt));

    recordTest(
      "Section 6",
      "6.8 Task completion: PUT /api/v1/events/tasks/:taskId with COMPLETED sets completedAt timestamp (HTTP 200)",
      isCompletedAtValid,
      `Expected completedAt timestamp, got: ${JSON.stringify(taskCompletedAt)}`
    );

    // 6.9 Revert Task to IN_PROGRESS: Verify completedAt reset to null!
    const resRevertTask = await apiRequest(`/api/v1/events/tasks/${testTaskId}`, {
      method: "PUT",
      token: adminToken,
      body: {
        status: TaskStatus.IN_PROGRESS,
      },
    });
    const isCompletedAtReset =
      resRevertTask.status === 200 &&
      resRevertTask.data?.data?.status === TaskStatus.IN_PROGRESS &&
      resRevertTask.data?.data?.completedAt === null;

    recordTest(
      "Section 6",
      "6.9 Task status rollback: Transitioning away from COMPLETED resets completedAt to null",
      isCompletedAtReset,
      `Expected completedAt=null, got: ${JSON.stringify(resRevertTask.data?.data?.completedAt)}`
    );

    // 6.10 Security: Client role PUT task returns HTTP 403 Forbidden
    const resClientUpdateTask = await apiRequest(`/api/v1/events/tasks/${testTaskId}`, {
      method: "PUT",
      token: clientAToken,
      body: {
        title: "Malicious Task Rename",
      },
    });
    recordTest(
      "Section 6",
      "6.10 Security: Client role PUT /api/v1/events/tasks/:taskId returns HTTP 403 Forbidden",
      resClientUpdateTask.status === 403 &&
        resClientUpdateTask.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientUpdateTask.status}`
    );

    // 6.11 Security: Client role DELETE task returns HTTP 403 Forbidden
    const resClientDeleteTask = await apiRequest(`/api/v1/events/tasks/${testTaskId}`, {
      method: "DELETE",
      token: clientAToken,
    });
    recordTest(
      "Section 6",
      "6.11 Security: Client role DELETE /api/v1/events/tasks/:taskId returns HTTP 403 Forbidden",
      resClientDeleteTask.status === 403 &&
        resClientDeleteTask.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientDeleteTask.status}`
    );

    // 6.12 Admin deletes task: DELETE /api/v1/events/tasks/:taskId
    const resDeleteTaskAdmin = await apiRequest(`/api/v1/events/tasks/${testTaskId}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 6",
      "6.12 Admin deletes task: DELETE /api/v1/events/tasks/:taskId returns HTTP 200 OK",
      resDeleteTaskAdmin.status === 200,
      `Expected 200, received: ${resDeleteTaskAdmin.status}`
    );

    // Verify task deleted from DB
    const dbTaskDeleted = await prisma.eventTask.findUnique({ where: { id: testTaskId } });
    recordTest(
      "Section 6",
      "6.13 Task confirmed purged from database",
      dbTaskDeleted === null,
      "Task still found in database after delete"
    );

    // 6.14 Delete non-existent taskId returns HTTP 404 NOT_FOUND
    const resDeleteNonExistentTask = await apiRequest(
      `/api/v1/events/tasks/${nonExistentEventId}`,
      {
        method: "DELETE",
        token: adminToken,
      }
    );
    recordTest(
      "Section 6",
      "6.14 Deleting non-existent task returns HTTP 404 NOT_FOUND",
      resDeleteNonExistentTask.status === 404 &&
        resDeleteNonExistentTask.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resDeleteNonExistentTask.status}`
    );

    // =========================================================================
    // SECTION 7: OPERATIONAL SCHEDULES SUB-RESOURCE
    // =========================================================================
    console.log("\n==> SECTION 7: Operational Schedules Sub-resource");

    let schedule1Id = "";
    let schedule2Id = "";

    // 7.1 Admin creates schedule: POST /api/v1/events/:eventId/schedules
    const schedStart1 = new Date(eventDate1.getTime());
    schedStart1.setUTCHours(14, 0, 0, 0); // 14:00 UTC
    const schedEnd1 = new Date(eventDate1.getTime());
    schedEnd1.setUTCHours(16, 0, 0, 0); // 16:00 UTC

    const resCreateSched1 = await apiRequest(`/api/v1/events/${event1Id}/schedules`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "Keynote & Panel Discussion",
        description: "Opening keynote by CEO followed by industry experts panel",
        startAt: schedStart1.toISOString(),
        endAt: schedEnd1.toISOString(),
      },
    });

    const isSched1Created =
      resCreateSched1.status === 201 &&
      resCreateSched1.data?.data?.id &&
      resCreateSched1.data?.data?.title === "Keynote & Panel Discussion";

    if (isSched1Created) {
      schedule1Id = resCreateSched1.data.data.id;
      createdScheduleIds.add(schedule1Id);
    }

    recordTest(
      "Section 7",
      "7.1 Admin creates operational schedule: POST /api/v1/events/:eventId/schedules returns HTTP 201 Created",
      isSched1Created,
      `Expected 201, received: ${resCreateSched1.status}`,
      resCreateSched1.data
    );

    // 7.2 Validation: endAt earlier than startAt returns HTTP 422
    const resInvalidSchedDates = await apiRequest(`/api/v1/events/${event1Id}/schedules`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "Invalid Timeline Schedule",
        startAt: schedEnd1.toISOString(),
        endAt: schedStart1.toISOString(), // endAt < startAt
      },
    });
    recordTest(
      "Section 7",
      "7.2 Date validation: endAt < startAt rejected with HTTP 422 VALIDATION_ERROR",
      resInvalidSchedDates.status === 422 &&
        resInvalidSchedDates.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resInvalidSchedDates.status}`,
      resInvalidSchedDates.data
    );

    // 7.3 Validation: title min 2 chars
    const resShortSchedTitle = await apiRequest(`/api/v1/events/${event1Id}/schedules`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "Z",
        startAt: schedStart1.toISOString(),
      },
    });
    recordTest(
      "Section 7",
      "7.3 Validation: Schedule title < 2 characters rejected with HTTP 422 VALIDATION_ERROR",
      resShortSchedTitle.status === 422 &&
        resShortSchedTitle.data?.error?.code === "VALIDATION_ERROR",
      `Expected 422, received: ${resShortSchedTitle.status}`
    );

    // 7.4 Non-existent eventId on schedule creation returns HTTP 404 NOT_FOUND
    const resSchedNonExistentEvent = await apiRequest(
      `/api/v1/events/${nonExistentEventId}/schedules`,
      {
        method: "POST",
        token: adminToken,
        body: {
          title: "Orphan Schedule",
          startAt: schedStart1.toISOString(),
        },
      }
    );
    recordTest(
      "Section 7",
      "7.4 Non-existent eventId on schedule creation returns HTTP 404 NOT_FOUND",
      resSchedNonExistentEvent.status === 404 &&
        resSchedNonExistentEvent.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resSchedNonExistentEvent.status}`
    );

    // 7.5 Security: Client role POST schedule returns HTTP 403 Forbidden
    const resClientCreateSched = await apiRequest(`/api/v1/events/${event1Id}/schedules`, {
      method: "POST",
      token: clientAToken,
      body: {
        title: "Client Unauthorized Schedule",
        startAt: schedStart1.toISOString(),
      },
    });
    recordTest(
      "Section 7",
      "7.5 Security: Client role POST schedule returns HTTP 403 Forbidden",
      resClientCreateSched.status === 403 &&
        resClientCreateSched.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientCreateSched.status}`
    );

    // 7.6 Security: Unauthenticated POST schedule returns HTTP 401 Unauthorized
    const resUnauthCreateSched = await apiRequest(`/api/v1/events/${event1Id}/schedules`, {
      method: "POST",
      body: {
        title: "Unauthenticated Schedule",
        startAt: schedStart1.toISOString(),
      },
    });
    recordTest(
      "Section 7",
      "7.6 Security: Unauthenticated POST schedule returns HTTP 401 Unauthorized",
      resUnauthCreateSched.status === 401 &&
        resUnauthCreateSched.data?.error?.code === "UNAUTHORIZED",
      `Expected 401, received: ${resUnauthCreateSched.status}`
    );

    // 7.7 Chronological Ordering: Create earlier schedule (10:00 UTC)
    const schedStart2 = new Date(eventDate1.getTime());
    schedStart2.setUTCHours(10, 0, 0, 0); // 10:00 UTC (before 14:00)
    const schedEnd2 = new Date(eventDate1.getTime());
    schedEnd2.setUTCHours(11, 30, 0, 0);

    const resCreateSched2 = await apiRequest(`/api/v1/events/${event1Id}/schedules`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "Registration & Breakfast Networking",
        description: "Guest arrivals and registration desk check-in",
        startAt: schedStart2.toISOString(),
        endAt: schedEnd2.toISOString(),
      },
    });

    if (resCreateSched2.status === 201 && resCreateSched2.data?.data?.id) {
      schedule2Id = resCreateSched2.data.data.id;
      createdScheduleIds.add(schedule2Id);
    }

    // List schedules: GET /api/v1/events/:eventId/schedules
    const resListSchedules = await apiRequest(`/api/v1/events/${event1Id}/schedules`, {
      token: adminToken,
    });
    const schedList: any[] = resListSchedules.data?.data || [];
    const isOrderedChronologically =
      resListSchedules.status === 200 &&
      schedList.length >= 2 &&
      schedList[0].id === schedule2Id && // 10:00 schedule comes first
      schedList[1].id === schedule1Id; // 14:00 schedule comes second

    recordTest(
      "Section 7",
      "7.7 Chronological ordering: GET /api/v1/events/:eventId/schedules returns schedules strictly sorted by startAt asc",
      isOrderedChronologically,
      "Schedules are not in expected chronological sequence (10:00 then 14:00)",
      schedList.map((s) => ({ title: s.title, startAt: s.startAt }))
    );

    // Client can list schedules for own event
    const resClientListSched = await apiRequest(`/api/v1/events/${event1Id}/schedules`, {
      token: clientAToken,
    });
    recordTest(
      "Section 7",
      "7.8 Client can retrieve operational schedules for own event (HTTP 200 OK)",
      resClientListSched.status === 200 && Array.isArray(resClientListSched.data?.data),
      `Expected 200, got: ${resClientListSched.status}`
    );

    // 7.9 Update Schedule: PUT /api/v1/events/schedules/:scheduleId
    const resUpdateSched = await apiRequest(`/api/v1/events/schedules/${schedule1Id}`, {
      method: "PUT",
      token: adminToken,
      body: {
        title: "Updated Keynote & Executive Fireside Chat",
        description: "Extended QA session added",
      },
    });
    const isSchedUpdated =
      resUpdateSched.status === 200 &&
      resUpdateSched.data?.data?.title === "Updated Keynote & Executive Fireside Chat";
    recordTest(
      "Section 7",
      "7.9 Admin updates operational schedule: PUT /api/v1/events/schedules/:scheduleId returns HTTP 200 OK",
      isSchedUpdated,
      `Expected 200 with updated title, got: ${resUpdateSched.status}`
    );

    // Update schedule validation: invalid date range
    const resUpdateSchedInvalid = await apiRequest(
      `/api/v1/events/schedules/${schedule1Id}`,
      {
        method: "PUT",
        token: adminToken,
        body: {
          startAt: "2026-12-20T16:00:00Z",
          endAt: "2026-12-20T12:00:00Z",
        },
      }
    );
    recordTest(
      "Section 7",
      "7.10 Schedule update validation: endAt < startAt rejected (HTTP 400 or 422)",
      resUpdateSchedInvalid.status === 422 || resUpdateSchedInvalid.status === 400,
      `Expected 422/400, received: ${resUpdateSchedInvalid.status}`
    );

    // 7.11 Security: Client role PUT schedule returns HTTP 403 Forbidden
    const resClientUpdateSched = await apiRequest(`/api/v1/events/schedules/${schedule1Id}`, {
      method: "PUT",
      token: clientAToken,
      body: {
        title: "Malicious Schedule Title",
      },
    });
    recordTest(
      "Section 7",
      "7.11 Security: Client role PUT schedule returns HTTP 403 Forbidden",
      resClientUpdateSched.status === 403 &&
        resClientUpdateSched.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientUpdateSched.status}`
    );

    // 7.12 Security: Client role DELETE schedule returns HTTP 403 Forbidden
    const resClientDeleteSched = await apiRequest(`/api/v1/events/schedules/${schedule1Id}`, {
      method: "DELETE",
      token: clientAToken,
    });
    recordTest(
      "Section 7",
      "7.12 Security: Client role DELETE schedule returns HTTP 403 Forbidden",
      resClientDeleteSched.status === 403 &&
        resClientDeleteSched.data?.error?.code === "FORBIDDEN",
      `Expected 403, received: ${resClientDeleteSched.status}`
    );

    // 7.13 Admin deletes schedule: DELETE /api/v1/events/schedules/:scheduleId
    const resDeleteSchedAdmin = await apiRequest(`/api/v1/events/schedules/${schedule1Id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 7",
      "7.13 Admin deletes operational schedule: DELETE /api/v1/events/schedules/:scheduleId returns HTTP 200 OK",
      resDeleteSchedAdmin.status === 200,
      `Expected 200, received: ${resDeleteSchedAdmin.status}`
    );

    // Verify schedule deleted from DB
    const dbSchedDeleted = await prisma.eventSchedule.findUnique({
      where: { id: schedule1Id },
    });
    recordTest(
      "Section 7",
      "7.14 Operational schedule confirmed purged from database",
      dbSchedDeleted === null,
      "Schedule still found in database after delete"
    );

    // 7.15 Delete non-existent scheduleId returns HTTP 404 NOT_FOUND
    const resDeleteNonExistentSched = await apiRequest(
      `/api/v1/events/schedules/${nonExistentEventId}`,
      {
        method: "DELETE",
        token: adminToken,
      }
    );
    recordTest(
      "Section 7",
      "7.15 Deleting non-existent schedule returns HTTP 404 NOT_FOUND",
      resDeleteNonExistentSched.status === 404 &&
        resDeleteNonExistentSched.data?.error?.code === "NOT_FOUND",
      `Expected 404, received: ${resDeleteNonExistentSched.status}`
    );
  } catch (suiteError) {
    console.error("FATAL SUITE ERROR:", suiteError);
    recordTest("Fatal", "Test Suite Execution without runtime exceptions", false, String(suiteError));
  } finally {
    // =========================================================================
    // SECTION 8: TEARDOWN, CLEANUP & ORPHAN RECORD VERIFICATION
    // =========================================================================
    console.log("\n==> SECTION 8: Teardown, Cleanup & Orphan Record Verification");

    try {
      // 1. Purge tasks
      const deletedTasks = await prisma.eventTask.deleteMany({
        where: { id: { in: Array.from(createdTaskIds) } },
      });
      console.log(`  [Teardown] Purged ${deletedTasks.count} tasks.`);

      // 2. Purge schedules
      const deletedSchedules = await prisma.eventSchedule.deleteMany({
        where: { id: { in: Array.from(createdScheduleIds) } },
      });
      console.log(`  [Teardown] Purged ${deletedSchedules.count} schedules.`);

      // 3. Purge payments
      const deletedPayments = await prisma.payment.deleteMany({
        where: { id: { in: Array.from(createdPaymentIds) } },
      });
      console.log(`  [Teardown] Purged ${deletedPayments.count} payments.`);

      // 4. Purge invoices
      const deletedInvoices = await prisma.invoice.deleteMany({
        where: { id: { in: Array.from(createdInvoiceIds) } },
      });
      console.log(`  [Teardown] Purged ${deletedInvoices.count} invoices.`);

      // 5. Purge expenses
      const deletedExpenses = await prisma.expense.deleteMany({
        where: { id: { in: Array.from(createdExpenseIds) } },
      });
      console.log(`  [Teardown] Purged ${deletedExpenses.count} expenses.`);

      // 6. Purge events (including any remaining tasks/schedules linked to createdEventIds)
      await prisma.eventTask.deleteMany({
        where: { eventId: { in: Array.from(createdEventIds) } },
      });
      await prisma.eventSchedule.deleteMany({
        where: { eventId: { in: Array.from(createdEventIds) } },
      });
      await prisma.calendarEntry.deleteMany({
        where: { eventId: { in: Array.from(createdEventIds) } },
      });
      const deletedEvents = await prisma.event.deleteMany({
        where: { id: { in: Array.from(createdEventIds) } },
      });
      console.log(`  [Teardown] Purged ${deletedEvents.count} events.`);

      // 7. Purge refresh tokens and users
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: Array.from(createdUserIds) } },
      });
      const deletedUsers = await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
      console.log(`  [Teardown] Purged ${deletedUsers.count} users.`);

      // 8. Purge clients
      const deletedClients = await prisma.client.deleteMany({
        where: { id: { in: Array.from(createdClientIds) } },
      });
      console.log(`  [Teardown] Purged ${deletedClients.count} clients.`);

      // Verify zero orphan records remaining in DB
      const remainingTasks = await prisma.eventTask.count({
        where: { id: { in: Array.from(createdTaskIds) } },
      });
      const remainingSchedules = await prisma.eventSchedule.count({
        where: { id: { in: Array.from(createdScheduleIds) } },
      });
      const remainingEvents = await prisma.event.count({
        where: { id: { in: Array.from(createdEventIds) } },
      });
      const remainingInvoices = await prisma.invoice.count({
        where: { id: { in: Array.from(createdInvoiceIds) } },
      });
      const remainingPayments = await prisma.payment.count({
        where: { id: { in: Array.from(createdPaymentIds) } },
      });
      const remainingExpenses = await prisma.expense.count({
        where: { id: { in: Array.from(createdExpenseIds) } },
      });
      const remainingUsers = await prisma.user.count({
        where: { id: { in: Array.from(createdUserIds) } },
      });
      const remainingClients = await prisma.client.count({
        where: { id: { in: Array.from(createdClientIds) } },
      });

      const isClean =
        remainingTasks === 0 &&
        remainingSchedules === 0 &&
        remainingEvents === 0 &&
        remainingInvoices === 0 &&
        remainingPayments === 0 &&
        remainingExpenses === 0 &&
        remainingUsers === 0 &&
        remainingClients === 0;

      recordTest(
        "Section 8",
        "8.1 Teardown: 0 orphan records remaining in DB across all test entities",
        isClean,
        `Lingering records: tasks=${remainingTasks}, schedules=${remainingSchedules}, events=${remainingEvents}, invoices=${remainingInvoices}, payments=${remainingPayments}, expenses=${remainingExpenses}, users=${remainingUsers}, clients=${remainingClients}`
      );
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
      recordTest("Section 8", "8.1 Teardown executed without errors", false, String(cleanupErr));
    }

    // 8.2 Schema integrity check: Verify backend/prisma/schema.prisma has not been modified
    const finalSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    const schemaIsUntouched = initialSchemaHash !== "" && initialSchemaHash === finalSchemaHash;
    recordTest(
      "Section 8",
      "8.2 Schema integrity: backend/prisma/schema.prisma has NOT been modified (SHA-256 match)",
      schemaIsUntouched,
      `Schema hash altered! initial=${initialSchemaHash}, final=${finalSchemaHash}`
    );

    // Stop test server & disconnect prisma
    if (server) {
      await new Promise<void>((resolve) => {
        (server as http.Server).close(() => {
          resolve();
        });
      });
      console.log("[Test Server] Ephemeral HTTP Server stopped.");
    }

    await prisma.$disconnect();
    console.log("[Test Database] Prisma connection disconnected.\n");
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";

  console.log("================================================================================");
  console.log(`       TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED) - Success Rate: ${successRate}%`);
  console.log("================================================================================");

  if (failed > 0) {
    console.error("\nFailed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(` - [${r.section}] ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log("\nALL PHASE 4 EVENT MANAGEMENT & LIFECYCLE TESTS PASSED WITH 100% SUCCESS RATE!\n");
    process.exit(0);
  }
}

runPhase4EventsTestSuite().catch((err) => {
  console.error("Unhandled test suite failure:", err);
  process.exit(1);
});
