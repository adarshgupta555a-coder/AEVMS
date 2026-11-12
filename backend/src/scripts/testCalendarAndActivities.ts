import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { USERROLE, CalendarEntryType } from "../generated/prisma/enums.js";
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

async function runCalendarAndActivitiesTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS CALENDAR & CLIENT ACTIVITIES AUTOMATED TEST SUITE");
  console.log("================================================================================\n");

  let server: http.Server | null = null;
  let baseUrl = "";
  let initialSchemaHash = "";

  // Entity tracking sets for cleanup
  const createdCalendarEntryIds = new Set<string>();
  const createdEventIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdClientIds = new Set<string>();

  // HTTP Helper
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
          clientId: null,
        },
      });
      console.log(`  [Setup] Created default admin account: ${admin.email}`);
    }

    const adminLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: admin.email,
        password: "Admin@123456",
      },
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.data?.data?.accessToken) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }

    const adminToken: string = adminLoginRes.data.data.accessToken;
    console.log(`  [Admin Authenticated] ID: ${admin.id}, Email: ${admin.email}\n`);

    // -------------------------------------------------------------------------
    // SETUP: Creating Test Clients, Users, and Events
    // -------------------------------------------------------------------------
    console.log("==> SETUP: Creating Test Clients, Users, and Events");
    const ts = Date.now();

    // Client A (Primary Client Tenant)
    const clientAPhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const clientAEmail = `client-a-cal-${ts}@testsuite.local`;
    const clientA = await prisma.client.create({
      data: {
        name: "Acme Events International",
        phone: clientAPhone,
        email: clientAEmail,
        address: "100 Grand Boulevard",
        city: "Mumbai",
        notes: "Primary test client for calendar activities",
      },
    });
    createdClientIds.add(clientA.id);

    const clientAPassword = "ClientA@CalendarPass123";
    const clientAPasswordHash = await hashPassword(clientAPassword);
    const userA = await prisma.user.create({
      data: {
        name: "Acme Client User",
        email: clientAEmail,
        passwordHash: clientAPasswordHash,
        role: USERROLE.CLIENT,
        isActive: true,
        clientId: clientA.id,
      },
    });
    createdUserIds.add(userA.id);

    // Login Client A
    const clientALoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: clientAEmail,
        password: clientAPassword,
      },
    });
    if (clientALoginRes.status !== 200 || !clientALoginRes.data?.data?.accessToken) {
      throw new Error(`Client A login failed: ${JSON.stringify(clientALoginRes.data)}`);
    }
    const clientAToken: string = clientALoginRes.data.data.accessToken;

    // Client B (Secondary Client Tenant for IDOR & Scoping)
    const clientBPhone = `92${Math.floor(10000000 + Math.random() * 90000000)}`;
    const clientBEmail = `client-b-cal-${ts}@testsuite.local`;
    const clientB = await prisma.client.create({
      data: {
        name: "Apex Corporate Summits",
        phone: clientBPhone,
        email: clientBEmail,
        address: "500 Horizon Drive",
        city: "Bengaluru",
        notes: "Secondary test client for cross-tenant IDOR validation",
      },
    });
    createdClientIds.add(clientB.id);

    const clientBPassword = "ClientB@CalendarPass123";
    const clientBPasswordHash = await hashPassword(clientBPassword);
    const userB = await prisma.user.create({
      data: {
        name: "Apex Client User",
        email: clientBEmail,
        passwordHash: clientBPasswordHash,
        role: USERROLE.CLIENT,
        isActive: true,
        clientId: clientB.id,
      },
    });
    createdUserIds.add(userB.id);

    // Login Client B
    const clientBLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: clientBEmail,
        password: clientBPassword,
      },
    });
    if (clientBLoginRes.status !== 200 || !clientBLoginRes.data?.data?.accessToken) {
      throw new Error(`Client B login failed: ${JSON.stringify(clientBLoginRes.data)}`);
    }
    const clientBToken: string = clientBLoginRes.data.data.accessToken;

    // Events for Client A and Client B
    const eventA1 = await prisma.event.create({
      data: {
        eventNumber: `EV-A1-${ts}`,
        clientId: clientA.id,
        title: "Acme Annual Leadership Summit 2026",
        eventType: "CONFERENCE",
        eventDate: new Date("2026-12-15T09:00:00Z"),
        createdById: admin.id,
      },
    });
    createdEventIds.add(eventA1.id);

    const eventB1 = await prisma.event.create({
      data: {
        eventNumber: `EV-B1-${ts}`,
        clientId: clientB.id,
        title: "Apex Tech Expo 2026",
        eventType: "EXPO",
        eventDate: new Date("2026-12-20T09:00:00Z"),
        createdById: admin.id,
      },
    });
    createdEventIds.add(eventB1.id);

    console.log(`  [Setup Complete] Client A (${clientA.id}), Client B (${clientB.id}), Events created.\n`);

    // =========================================================================
    // SECTION 1: POST /api/v1/calendar (Creation, Types, Validation & RBAC)
    // =========================================================================
    console.log("==> SECTION 1: POST /api/v1/calendar (Creation, Types, Fields, Validation & RBAC)");

    // 1.1 Valid entry creation with all types: MEETING, SITE_VISIT, VENDOR_MEETING, OFFICE_ACTIVITY, OTHER
    const entryTypes: CalendarEntryType[] = [
      CalendarEntryType.MEETING,
      CalendarEntryType.SITE_VISIT,
      CalendarEntryType.VENDOR_MEETING,
      CalendarEntryType.OFFICE_ACTIVITY,
      CalendarEntryType.OTHER,
    ];

    const createdEntriesMap: Record<string, any> = {};

    for (const [i, type] of entryTypes.entries()) {
      const startAt = new Date(Date.now() + (i + 1) * 86400000);
      const endAt = new Date(startAt.getTime() + 2 * 3600000); // 2 hours later

      const createRes = await apiRequest("/api/v1/calendar", {
        method: "POST",
        token: adminToken,
        body: {
          title: `Project Milestone ${type}`,
          description: `Detailed planning session for type ${type}`,
          type,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          allDay: false,
          location: `Conference Room ${i + 1}, HQ`,
          clientId: clientA.id,
          eventId: eventA1.id,
        },
      });

      const entryData = createRes.data?.data;
      if (entryData?.id) {
        createdCalendarEntryIds.add(entryData.id);
        createdEntriesMap[type] = entryData;
      }

      recordTest(
        "Section 1",
        `1.1.${i + 1} POST /api/v1/calendar with type=${type} returns HTTP 201 Created`,
        createRes.status === 201 && entryData?.type === type && entryData?.clientId === clientA.id,
        `Status: ${createRes.status}, Body: ${JSON.stringify(createRes.data)}`
      );
    }

    // 1.2 Verification of all fields in response and database
    const meetingEntry = createdEntriesMap[CalendarEntryType.MEETING];
    const dbMeetingEntry = meetingEntry?.id
      ? await prisma.calendarEntry.findUnique({
          where: { id: meetingEntry.id },
          include: { client: true, event: true, createdBy: true },
        })
      : null;

    const fieldsCorrect =
      dbMeetingEntry !== null &&
      dbMeetingEntry.title === `Project Milestone ${CalendarEntryType.MEETING}` &&
      dbMeetingEntry.description === `Detailed planning session for type ${CalendarEntryType.MEETING}` &&
      dbMeetingEntry.type === CalendarEntryType.MEETING &&
      dbMeetingEntry.allDay === false &&
      dbMeetingEntry.location === "Conference Room 1, HQ" &&
      dbMeetingEntry.clientId === clientA.id &&
      dbMeetingEntry.eventId === eventA1.id &&
      dbMeetingEntry.createdById === admin.id;

    recordTest(
      "Section 1",
      "1.2 All fields (title, desc, type, dates, allDay, location, client, event, createdBy) properly saved and verified",
      fieldsCorrect,
      `dbEntry mismatch or null: ${JSON.stringify(dbMeetingEntry)}`
    );

    // 1.3 Date validation: endAt < startAt returns HTTP 422
    const invalidDateRes = await apiRequest("/api/v1/calendar", {
      method: "POST",
      token: adminToken,
      body: {
        title: "Invalid Chronological Order Meeting",
        type: CalendarEntryType.MEETING,
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: new Date(Date.now()).toISOString(), // endAt is in the past compared to startAt
        clientId: clientA.id,
      },
    });

    recordTest(
      "Section 1",
      "1.3 Date validation: endAt < startAt returns HTTP 422 Unprocessable Entity",
      invalidDateRes.status === 422,
      `Expected 422, got ${invalidDateRes.status}: ${JSON.stringify(invalidDateRes.data)}`
    );

    // 1.4 Missing title returns HTTP 422
    const missingTitleRes = await apiRequest("/api/v1/calendar", {
      method: "POST",
      token: adminToken,
      body: {
        description: "Entry without a title",
        type: CalendarEntryType.OTHER,
        startAt: new Date().toISOString(),
        clientId: clientA.id,
      },
    });

    recordTest(
      "Section 1",
      "1.4 Missing title returns HTTP 422 Unprocessable Entity",
      missingTitleRes.status === 422,
      `Expected 422, got ${missingTitleRes.status}: ${JSON.stringify(missingTitleRes.data)}`
    );

    // 1.5 Title < 2 chars returns HTTP 422
    const shortTitleRes = await apiRequest("/api/v1/calendar", {
      method: "POST",
      token: adminToken,
      body: {
        title: "X",
        type: CalendarEntryType.OTHER,
        startAt: new Date().toISOString(),
        clientId: clientA.id,
      },
    });

    recordTest(
      "Section 1",
      "1.5 Title < 2 characters returns HTTP 422 Unprocessable Entity",
      shortTitleRes.status === 422,
      `Expected 422, got ${shortTitleRes.status}: ${JSON.stringify(shortTitleRes.data)}`
    );

    // 1.6 Non-existent clientId returns HTTP 404
    const nonExistentClientId = crypto.randomUUID();
    const nonExistentClientRes = await apiRequest("/api/v1/calendar", {
      method: "POST",
      token: adminToken,
      body: {
        title: "Ghost Client Meeting",
        type: CalendarEntryType.MEETING,
        startAt: new Date().toISOString(),
        clientId: nonExistentClientId,
      },
    });

    recordTest(
      "Section 1",
      "1.6 Non-existent clientId returns HTTP 404 Not Found",
      nonExistentClientRes.status === 404,
      `Expected 404, got ${nonExistentClientRes.status}: ${JSON.stringify(nonExistentClientRes.data)}`
    );

    // 1.7 eventId belonging to a different client returns HTTP 400
    const mismatchEventRes = await apiRequest("/api/v1/calendar", {
      method: "POST",
      token: adminToken,
      body: {
        title: "Cross Client Mismatch Activity",
        type: CalendarEntryType.MEETING,
        startAt: new Date().toISOString(),
        clientId: clientA.id,
        eventId: eventB1.id, // Belongs to Client B, NOT Client A!
      },
    });

    recordTest(
      "Section 1",
      "1.7 eventId belonging to a different client returns HTTP 400 Bad Request",
      mismatchEventRes.status === 400,
      `Expected 400, got ${mismatchEventRes.status}: ${JSON.stringify(mismatchEventRes.data)}`
    );

    // 1.8 Security: Unauthenticated returns HTTP 401
    const unauthPostRes = await apiRequest("/api/v1/calendar", {
      method: "POST",
      body: {
        title: "Hacker Infiltration Attempt",
        type: CalendarEntryType.MEETING,
        startAt: new Date().toISOString(),
        clientId: clientA.id,
      },
    });

    recordTest(
      "Section 1",
      "1.8 Security: Unauthenticated POST returns HTTP 401 Unauthorized",
      unauthPostRes.status === 401,
      `Expected 401, got ${unauthPostRes.status}: ${JSON.stringify(unauthPostRes.data)}`
    );

    // 1.9 Security: Client role returns HTTP 403 (Admin-only creation)
    const clientRolePostRes = await apiRequest("/api/v1/calendar", {
      method: "POST",
      token: clientAToken,
      body: {
        title: "Client Unauthorized Self-Creation",
        type: CalendarEntryType.MEETING,
        startAt: new Date().toISOString(),
        clientId: clientA.id,
      },
    });

    recordTest(
      "Section 1",
      "1.9 Security: Client role POST returns HTTP 403 Forbidden (Admin-only creation)",
      clientRolePostRes.status === 403,
      `Expected 403, got ${clientRolePostRes.status}: ${JSON.stringify(clientRolePostRes.data)}`
    );

    // Create an entry for Client B as well for cross-client testing
    const clientBEntryRes = await apiRequest("/api/v1/calendar", {
      method: "POST",
      token: adminToken,
      body: {
        title: "Apex Exclusive Technical Review",
        description: "Confidential roadmap and venue tech walk",
        type: CalendarEntryType.SITE_VISIT,
        startAt: new Date(Date.now() + 10 * 86400000).toISOString(),
        endAt: new Date(Date.now() + 10 * 86400000 + 3600000).toISOString(),
        allDay: false,
        location: "Apex Convention Center, Hall B",
        clientId: clientB.id,
        eventId: eventB1.id,
      },
    });
    const clientBEntry = clientBEntryRes.data?.data;
    if (clientBEntry?.id) {
      createdCalendarEntryIds.add(clientBEntry.id);
    }
    console.log(`  [Client B Entry Created] ID: ${clientBEntry?.id}\n`);

    // =========================================================================
    // SECTION 2: GET /api/v1/calendar (Filtering, Search, Pagination & RBAC)
    // =========================================================================
    console.log("==> SECTION 2: GET /api/v1/calendar (Filtering, Search, Pagination & RBAC)");

    // 2.1 Filter by date range (from, to)
    const fromDate = new Date(Date.now()).toISOString();
    const toDate = new Date(Date.now() + 4 * 86400000).toISOString();
    const dateRangeRes = await apiRequest(`/api/v1/calendar?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`, {
      method: "GET",
      token: adminToken,
    });

    const inRangeEntries = dateRangeRes.data?.data || [];
    const allInRange = inRangeEntries.every((e: any) => {
      const s = new Date(e.startAt).getTime();
      return s >= new Date(fromDate).getTime() && s <= new Date(toDate).getTime();
    });

    recordTest(
      "Section 2",
      "2.1 Filter by date range (from, to) returns only entries within startAt window",
      dateRangeRes.status === 200 && inRangeEntries.length > 0 && allInRange,
      `Status: ${dateRangeRes.status}, count: ${inRangeEntries.length}`
    );

    // 2.2 Filter by type (e.g. MEETING)
    const typeFilterRes = await apiRequest(`/api/v1/calendar?type=${CalendarEntryType.MEETING}`, {
      method: "GET",
      token: adminToken,
    });
    const typeEntries = typeFilterRes.data?.data || [];
    const allAreMeetings = typeEntries.length > 0 && typeEntries.every((e: any) => e.type === CalendarEntryType.MEETING);

    recordTest(
      "Section 2",
      "2.2 Filter by type=MEETING returns only entries matching type",
      typeFilterRes.status === 200 && allAreMeetings,
      `Status: ${typeFilterRes.status}, count: ${typeEntries.length}`
    );

    // 2.3 Filter by clientId (Admin querying Client A's entries)
    const clientFilterRes = await apiRequest(`/api/v1/calendar?clientId=${clientA.id}`, {
      method: "GET",
      token: adminToken,
    });
    const clientAEntries = clientFilterRes.data?.data || [];
    const allClientA = clientAEntries.length > 0 && clientAEntries.every((e: any) => e.clientId === clientA.id);

    recordTest(
      "Section 2",
      "2.3 Filter by clientId returns exclusively entries belonging to that client",
      clientFilterRes.status === 200 && allClientA,
      `Status: ${clientFilterRes.status}, count: ${clientAEntries.length}`
    );

    // 2.4 Search by title or description keyword
    const searchRes = await apiRequest(`/api/v1/calendar?search=Confidential`, {
      method: "GET",
      token: adminToken,
    });
    const searchEntries = searchRes.data?.data || [];
    const searchMatches = searchEntries.length > 0 && searchEntries.some((e: any) => e.id === clientBEntry.id);

    recordTest(
      "Section 2",
      "2.4 Search keyword in description matches target entry",
      searchRes.status === 200 && searchMatches,
      `Status: ${searchRes.status}, matches: ${searchEntries.length}`
    );

    // 2.5 Pagination (page, limit) and meta verification
    const page1Res = await apiRequest(`/api/v1/calendar?page=1&limit=2`, {
      method: "GET",
      token: adminToken,
    });
    const page1Data = page1Res.data?.data || [];
    const page1Meta = page1Res.data?.meta;

    const page2Res = await apiRequest(`/api/v1/calendar?page=2&limit=2`, {
      method: "GET",
      token: adminToken,
    });
    const page2Data = page2Res.data?.data || [];
    const page2Meta = page2Res.data?.meta;

    const paginationValid =
      page1Res.status === 200 &&
      page2Res.status === 200 &&
      page1Data.length === 2 &&
      page2Data.length === 2 &&
      page1Meta?.page === 1 &&
      page1Meta?.limit === 2 &&
      page1Meta?.total >= 6 &&
      page1Data[0].id !== page2Data[0].id;

    recordTest(
      "Section 2",
      "2.5 Pagination (page, limit) returns expected chunk and valid meta attributes",
      paginationValid,
      `Page1 count: ${page1Data.length}, Page2 count: ${page2Data.length}, Meta: ${JSON.stringify(page1Meta)}`
    );

    // 2.6 RBAC Scoping: Admin sees entries across clients
    const adminListRes = await apiRequest("/api/v1/calendar?limit=100", {
      method: "GET",
      token: adminToken,
    });
    const adminEntries = adminListRes.data?.data || [];
    const adminSeesBoth =
      adminEntries.some((e: any) => e.clientId === clientA.id) &&
      adminEntries.some((e: any) => e.clientId === clientB.id);

    recordTest(
      "Section 2",
      "2.6a RBAC Scoping: Admin sees entries across all clients",
      adminListRes.status === 200 && adminSeesBoth,
      `Admin count: ${adminEntries.length}`
    );

    // 2.7 RBAC Scoping: Client user sees ONLY entries matching their own clientId
    const clientAListRes = await apiRequest("/api/v1/calendar?limit=100", {
      method: "GET",
      token: clientAToken,
    });
    const clientAList = clientAListRes.data?.data || [];
    const clientAIsScoped =
      clientAList.length > 0 &&
      clientAList.every((e: any) => e.clientId === clientA.id) &&
      !clientAList.some((e: any) => e.clientId === clientB.id);

    recordTest(
      "Section 2",
      "2.7a RBAC Scoping: Client user sees ONLY entries matching their own clientId",
      clientAListRes.status === 200 && clientAIsScoped,
      `Client A count: ${clientAList.length}`
    );

    // 2.8 RBAC Scoping: Client user supplying another clientId parameter cannot escape scoping
    const clientATamperRes = await apiRequest(`/api/v1/calendar?clientId=${clientB.id}`, {
      method: "GET",
      token: clientAToken,
    });
    const clientATamperList = clientATamperRes.data?.data || [];
    const tamperPrevented =
      clientATamperList.length > 0 &&
      clientATamperList.every((e: any) => e.clientId === clientA.id) &&
      !clientATamperList.some((e: any) => e.clientId === clientB.id);

    recordTest(
      "Section 2",
      "2.8 RBAC Scoping: Client user attempting to filter another clientId is strictly clamped to own tenant",
      clientATamperRes.status === 200 && tamperPrevented,
      `Tamper list count: ${clientATamperList.length}`
    );

    // =========================================================================
    // SECTION 3: GET /api/v1/calendar/:id (Single Entry & IDOR Protection)
    // =========================================================================
    console.log("==> SECTION 3: GET /api/v1/calendar/:id (Single Entry & IDOR Protection)");

    // 3.1 Admin retrieves any entry (HTTP 200)
    const adminGetAEntryRes = await apiRequest(`/api/v1/calendar/${meetingEntry.id}`, {
      method: "GET",
      token: adminToken,
    });
    const adminGetBEntryRes = await apiRequest(`/api/v1/calendar/${clientBEntry.id}`, {
      method: "GET",
      token: adminToken,
    });

    recordTest(
      "Section 3",
      "3.1 Admin retrieves any calendar entry across tenants (HTTP 200)",
      adminGetAEntryRes.status === 200 &&
        adminGetBEntryRes.status === 200 &&
        adminGetAEntryRes.data?.data?.id === meetingEntry.id &&
        adminGetBEntryRes.data?.data?.id === clientBEntry.id,
      `A: ${adminGetAEntryRes.status}, B: ${adminGetBEntryRes.status}`
    );

    // 3.2 Client retrieves their own entry (HTTP 200)
    const clientGetOwnEntryRes = await apiRequest(`/api/v1/calendar/${meetingEntry.id}`, {
      method: "GET",
      token: clientAToken,
    });

    recordTest(
      "Section 3",
      "3.2 Client user retrieves their own calendar entry (HTTP 200)",
      clientGetOwnEntryRes.status === 200 && clientGetOwnEntryRes.data?.data?.id === meetingEntry.id,
      `Status: ${clientGetOwnEntryRes.status}`
    );

    // 3.3 IDOR Protection: Client accessing another client's calendar entry receives HTTP 403 Forbidden
    const idorRes = await apiRequest(`/api/v1/calendar/${clientBEntry.id}`, {
      method: "GET",
      token: clientAToken, // Client A token requesting Client B entry
    });

    recordTest(
      "Section 3",
      "3.3 IDOR Protection: Client accessing another client's entry receives HTTP 403 Forbidden",
      idorRes.status === 403,
      `Expected 403, got ${idorRes.status}: ${JSON.stringify(idorRes.data)}`
    );

    // 3.4 Non-existent ID returns HTTP 404 Not Found
    const nonExistentEntryId = crypto.randomUUID();
    const notFoundEntryRes = await apiRequest(`/api/v1/calendar/${nonExistentEntryId}`, {
      method: "GET",
      token: adminToken,
    });

    recordTest(
      "Section 3",
      "3.4 Non-existent calendar entry ID returns HTTP 404 Not Found",
      notFoundEntryRes.status === 404,
      `Expected 404, got ${notFoundEntryRes.status}: ${JSON.stringify(notFoundEntryRes.data)}`
    );

    // 3.5 Unauthenticated request returns HTTP 401
    const unauthGetRes = await apiRequest(`/api/v1/calendar/${meetingEntry.id}`, {
      method: "GET",
    });

    recordTest(
      "Section 3",
      "3.5 Unauthenticated GET /:id returns HTTP 401 Unauthorized",
      unauthGetRes.status === 401,
      `Expected 401, got ${unauthGetRes.status}`
    );

    // =========================================================================
    // SECTION 4: PUT /api/v1/calendar/:id (Update, Validation & RBAC)
    // =========================================================================
    console.log("==> SECTION 4: PUT /api/v1/calendar/:id (Update, Validation & RBAC)");

    const targetToUpdate = createdEntriesMap[CalendarEntryType.OTHER];
    const newTitle = "Updated Global Strategy Meeting";
    const newLocation = "Boardroom 101, Executive Tower";
    const newStartAt = new Date(Date.now() + 5 * 86400000);
    const newEndAt = new Date(newStartAt.getTime() + 4 * 3600000);

    // 4.1 Admin updates title, location, date/time, type (HTTP 200)
    const updateRes = await apiRequest(`/api/v1/calendar/${targetToUpdate.id}`, {
      method: "PUT",
      token: adminToken,
      body: {
        title: newTitle,
        location: newLocation,
        type: CalendarEntryType.OFFICE_ACTIVITY,
        startAt: newStartAt.toISOString(),
        endAt: newEndAt.toISOString(),
      },
    });

    const updatedData = updateRes.data?.data;
    const dbUpdated = await prisma.calendarEntry.findUnique({
      where: { id: targetToUpdate.id },
    });

    const updateVerified =
      updateRes.status === 200 &&
      updatedData?.title === newTitle &&
      updatedData?.location === newLocation &&
      updatedData?.type === CalendarEntryType.OFFICE_ACTIVITY &&
      dbUpdated?.title === newTitle &&
      dbUpdated?.location === newLocation &&
      dbUpdated?.type === CalendarEntryType.OFFICE_ACTIVITY;

    recordTest(
      "Section 4",
      "4.1 Admin updates title, location, date/time, type successfully (HTTP 200 & DB confirmed)",
      updateVerified,
      `Status: ${updateRes.status}, data: ${JSON.stringify(updatedData)}`
    );

    // 4.2 Non-admin (Client role) returns HTTP 403 Forbidden
    const clientUpdateRes = await apiRequest(`/api/v1/calendar/${targetToUpdate.id}`, {
      method: "PUT",
      token: clientAToken,
      body: {
        title: "Malicious Client Modification",
      },
    });

    recordTest(
      "Section 4",
      "4.2 Non-admin (Client role) PUT returns HTTP 403 Forbidden",
      clientUpdateRes.status === 403,
      `Expected 403, got ${clientUpdateRes.status}`
    );

    // 4.3 Invalid dates (endAt < startAt) return HTTP 422
    const invalidDateUpdateRes = await apiRequest(`/api/v1/calendar/${targetToUpdate.id}`, {
      method: "PUT",
      token: adminToken,
      body: {
        startAt: new Date(Date.now() + 10 * 86400000).toISOString(),
        endAt: new Date(Date.now() + 9 * 86400000).toISOString(),
      },
    });

    recordTest(
      "Section 4",
      "4.3 Invalid dates in update (endAt < startAt) return HTTP 422 Unprocessable Entity",
      invalidDateUpdateRes.status === 422,
      `Expected 422, got ${invalidDateUpdateRes.status}: ${JSON.stringify(invalidDateUpdateRes.data)}`
    );

    // 4.4 Update with eventId belonging to another client returns HTTP 400
    const invalidEventUpdateRes = await apiRequest(`/api/v1/calendar/${targetToUpdate.id}`, {
      method: "PUT",
      token: adminToken,
      body: {
        eventId: eventB1.id, // targetToUpdate belongs to client A!
      },
    });

    recordTest(
      "Section 4",
      "4.4 Update with eventId belonging to another client returns HTTP 400 Bad Request",
      invalidEventUpdateRes.status === 400,
      `Expected 400, got ${invalidEventUpdateRes.status}: ${JSON.stringify(invalidEventUpdateRes.data)}`
    );

    // =========================================================================
    // SECTION 5: DELETE /api/v1/calendar/:id (Deletion & RBAC)
    // =========================================================================
    console.log("==> SECTION 5: DELETE /api/v1/calendar/:id (Deletion & RBAC)");

    const targetToDelete = createdEntriesMap[CalendarEntryType.VENDOR_MEETING];

    // 5.1 Non-admin (Client role) returns HTTP 403 Forbidden
    const clientDeleteRes = await apiRequest(`/api/v1/calendar/${targetToDelete.id}`, {
      method: "DELETE",
      token: clientAToken,
    });

    recordTest(
      "Section 5",
      "5.1 Non-admin (Client role) DELETE returns HTTP 403 Forbidden",
      clientDeleteRes.status === 403,
      `Expected 403, got ${clientDeleteRes.status}`
    );

    // 5.2 Admin deletes entry (HTTP 200)
    const adminDeleteRes = await apiRequest(`/api/v1/calendar/${targetToDelete.id}`, {
      method: "DELETE",
      token: adminToken,
    });

    recordTest(
      "Section 5",
      "5.2 Admin deletes calendar entry returns HTTP 200 OK",
      adminDeleteRes.status === 200,
      `Expected 200, got ${adminDeleteRes.status}: ${JSON.stringify(adminDeleteRes.data)}`
    );

    // 5.3 Entry confirmed deleted from database
    const dbDeletedCheck = await prisma.calendarEntry.findUnique({
      where: { id: targetToDelete.id },
    });
    if (!dbDeletedCheck) {
      createdCalendarEntryIds.delete(targetToDelete.id); // No longer exists
    }

    recordTest(
      "Section 5",
      "5.3 Calendar entry is confirmed purged from the database",
      dbDeletedCheck === null,
      `Entry still found in DB: ${JSON.stringify(dbDeletedCheck)}`
    );

    // 5.4 Deleting already-deleted entry returns HTTP 404
    const deleteAgainRes = await apiRequest(`/api/v1/calendar/${targetToDelete.id}`, {
      method: "DELETE",
      token: adminToken,
    });

    recordTest(
      "Section 5",
      "5.4 Deleting non-existent/purged entry returns HTTP 404 Not Found",
      deleteAgainRes.status === 404,
      `Expected 404, got ${deleteAgainRes.status}`
    );

    // =========================================================================
    // SECTION 6: Client-scoped sub-resource routes
    // =========================================================================
    console.log("==> SECTION 6: Client-scoped sub-resource routes (/clients/:id/activities & /calendar)");

    // 6.1 Admin creates activity for client via route param :id POST /api/v1/clients/:id/activities
    const clientActivityCreateRes = await apiRequest(`/api/v1/clients/${clientA.id}/activities`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "Client Portal Onboarding Walkthrough",
        description: "Admin initiated walkthrough via client sub-resource route",
        type: CalendarEntryType.MEETING,
        startAt: new Date(Date.now() + 3 * 86400000).toISOString(),
        endAt: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString(),
        location: "Virtual - Zoom Meeting Room 1",
      },
    });

    const clientActivityEntry = clientActivityCreateRes.data?.data;
    if (clientActivityEntry?.id) {
      createdCalendarEntryIds.add(clientActivityEntry.id);
    }

    recordTest(
      "Section 6",
      "6.1 Admin creates activity via POST /api/v1/clients/:id/activities (HTTP 201 Created)",
      clientActivityCreateRes.status === 201 &&
        clientActivityEntry?.clientId === clientA.id &&
        clientActivityEntry?.title === "Client Portal Onboarding Walkthrough",
      `Status: ${clientActivityCreateRes.status}, data: ${JSON.stringify(clientActivityEntry)}`
    );

    // 6.2 Admin creates activity via route alias POST /api/v1/clients/:id/calendar
    const clientCalendarCreateRes = await apiRequest(`/api/v1/clients/${clientA.id}/calendar`, {
      method: "POST",
      token: adminToken,
      body: {
        title: "VIP Venue Tasting Session",
        type: CalendarEntryType.SITE_VISIT,
        startAt: new Date(Date.now() + 4 * 86400000).toISOString(),
        location: "Grand Banquet Hall Kitchen",
      },
    });

    const clientCalendarEntry = clientCalendarCreateRes.data?.data;
    if (clientCalendarEntry?.id) {
      createdCalendarEntryIds.add(clientCalendarEntry.id);
    }

    recordTest(
      "Section 6",
      "6.2 Admin creates activity via alias POST /api/v1/clients/:id/calendar (HTTP 201 Created)",
      clientCalendarCreateRes.status === 201 && clientCalendarEntry?.clientId === clientA.id,
      `Status: ${clientCalendarCreateRes.status}`
    );

    // 6.3 Client user creating via sub-resource route is rejected (HTTP 403 Forbidden)
    const clientSubResourceCreateRes = await apiRequest(`/api/v1/clients/${clientA.id}/activities`, {
      method: "POST",
      token: clientAToken,
      body: {
        title: "Client Unauthorized Self-Creation via Subroute",
        type: CalendarEntryType.MEETING,
        startAt: new Date().toISOString(),
      },
    });

    recordTest(
      "Section 6",
      "6.3 Client role POST /api/v1/clients/:id/activities returns HTTP 403 Forbidden",
      clientSubResourceCreateRes.status === 403,
      `Expected 403, got ${clientSubResourceCreateRes.status}`
    );

    // 6.4 Client retrieves their own activities via GET /api/v1/clients/:id/activities (HTTP 200)
    const clientOwnActivitiesRes = await apiRequest(`/api/v1/clients/${clientA.id}/activities`, {
      method: "GET",
      token: clientAToken,
    });
    const ownActivities = clientOwnActivitiesRes.data?.data || [];
    const clientMeta = clientOwnActivitiesRes.data?.meta;

    recordTest(
      "Section 6",
      "6.4 Client retrieves their own activities via GET /api/v1/clients/:id/activities (HTTP 200)",
      clientOwnActivitiesRes.status === 200 && ownActivities.length > 0 && clientMeta !== undefined,
      `Status: ${clientOwnActivitiesRes.status}, count: ${ownActivities.length}`
    );

    // 6.5 Client retrieves their own calendar via alias GET /api/v1/clients/:id/calendar (HTTP 200)
    const clientOwnCalendarRes = await apiRequest(`/api/v1/clients/${clientA.id}/calendar`, {
      method: "GET",
      token: clientAToken,
    });
    const ownCalendar = clientOwnCalendarRes.data?.data || [];

    recordTest(
      "Section 6",
      "6.5 Client retrieves their own activities via alias GET /api/v1/clients/:id/calendar (HTTP 200)",
      clientOwnCalendarRes.status === 200 && ownCalendar.length > 0,
      `Status: ${clientOwnCalendarRes.status}, count: ${ownCalendar.length}`
    );

    // 6.6 Admin retrieves any client's activities (HTTP 200)
    const adminGetClientBActivitiesRes = await apiRequest(`/api/v1/clients/${clientB.id}/activities`, {
      method: "GET",
      token: adminToken,
    });
    const clientBActivities = adminGetClientBActivitiesRes.data?.data || [];

    recordTest(
      "Section 6",
      "6.6 Admin retrieves client B's activities via GET /api/v1/clients/:id/activities (HTTP 200)",
      adminGetClientBActivitiesRes.status === 200 && clientBActivities.length > 0,
      `Status: ${adminGetClientBActivitiesRes.status}, count: ${clientBActivities.length}`
    );

    // 6.7 IDOR Protection: Client A receives HTTP 403 Forbidden when requesting Client B's activities
    const clientAIdorActivitiesRes = await apiRequest(`/api/v1/clients/${clientB.id}/activities`, {
      method: "GET",
      token: clientAToken, // Client A token requesting Client B's sub-resource
    });

    recordTest(
      "Section 6",
      "6.7 IDOR Protection: Client A receives HTTP 403 Forbidden when requesting Client B's activities",
      clientAIdorActivitiesRes.status === 403,
      `Expected 403, got ${clientAIdorActivitiesRes.status}: ${JSON.stringify(clientAIdorActivitiesRes.data)}`
    );

    // 6.8 IDOR Protection: Client A receives HTTP 403 Forbidden when requesting Client B's calendar alias
    const clientAIdorCalendarRes = await apiRequest(`/api/v1/clients/${clientB.id}/calendar`, {
      method: "GET",
      token: clientAToken, // Client A token requesting Client B's calendar alias
    });

    recordTest(
      "Section 6",
      "6.8 IDOR Protection: Client A receives HTTP 403 Forbidden when requesting Client B's calendar alias",
      clientAIdorCalendarRes.status === 403,
      `Expected 403, got ${clientAIdorCalendarRes.status}: ${JSON.stringify(clientAIdorCalendarRes.data)}`
    );

  } catch (err) {
    console.error("Critical test execution error:", err);
    recordTest("Fatal", "Unexpected exception during test execution", false, String(err));
  } finally {
    // =========================================================================
    // SECTION 7: Teardown, Cleanup & Orphan Record Verification
    // =========================================================================
    console.log("\n==> SECTION 7: Teardown, Cleanup & Orphan Record Verification");

    try {
      // 1. Delete all tracked calendar entries
      if (createdCalendarEntryIds.size > 0) {
        const deletedCal = await prisma.calendarEntry.deleteMany({
          where: { id: { in: Array.from(createdCalendarEntryIds) } },
        });
        console.log(`  [Teardown] Purged ${deletedCal.count} calendar entries.`);
      }

      // 2. Delete all tracked events
      if (createdEventIds.size > 0) {
        const deletedEvents = await prisma.event.deleteMany({
          where: { id: { in: Array.from(createdEventIds) } },
        });
        console.log(`  [Teardown] Purged ${deletedEvents.count} events.`);
      }

      // 3. Delete all tracked users
      if (createdUserIds.size > 0) {
        const deletedUsers = await prisma.user.deleteMany({
          where: { id: { in: Array.from(createdUserIds) } },
        });
        console.log(`  [Teardown] Purged ${deletedUsers.count} users.`);
      }

      // 4. Delete all tracked clients
      if (createdClientIds.size > 0) {
        const deletedClients = await prisma.client.deleteMany({
          where: { id: { in: Array.from(createdClientIds) } },
        });
        console.log(`  [Teardown] Purged ${deletedClients.count} clients.`);
      }

      // 5. Verify 0 orphan records in DB for tracked IDs
      const remainingCal = await prisma.calendarEntry.count({
        where: { id: { in: Array.from(createdCalendarEntryIds) } },
      });
      const remainingEvents = await prisma.event.count({
        where: { id: { in: Array.from(createdEventIds) } },
      });
      const remainingUsers = await prisma.user.count({
        where: { id: { in: Array.from(createdUserIds) } },
      });
      const remainingClients = await prisma.client.count({
        where: { id: { in: Array.from(createdClientIds) } },
      });

      const isClean =
        remainingCal === 0 &&
        remainingEvents === 0 &&
        remainingUsers === 0 &&
        remainingClients === 0;

      recordTest(
        "Section 7",
        "7.1 Teardown: 0 orphan records remaining in DB (calendar, events, users, clients)",
        isClean,
        `Lingering records: calendar=${remainingCal}, events=${remainingEvents}, users=${remainingUsers}, clients=${remainingClients}`
      );
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
      recordTest("Section 7", "7.1 Teardown: Cleanup executed without error", false, String(cleanupErr));
    }

    // 7.2 Schema integrity check: Verify backend/prisma/schema.prisma has not been modified
    const finalSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    const schemaIsUntouched = initialSchemaHash !== "" && initialSchemaHash === finalSchemaHash;
    recordTest(
      "Section 7",
      "7.2 Schema integrity: backend/prisma/schema.prisma has NOT been modified (SHA-256 match)",
      schemaIsUntouched,
      `Schema hash altered! initial=${initialSchemaHash}, final=${finalSchemaHash}`
    );

    // Shutdown test server & disconnect prisma
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
    console.log("\nALL CALENDAR & CLIENT ACTIVITIES TESTS PASSED WITH 100% SUCCESS RATE!\n");
    process.exit(0);
  }
}

runCalendarAndActivitiesTestSuite().catch((err) => {
  console.error("Unhandled test suite failure:", err);
  process.exit(1);
});
