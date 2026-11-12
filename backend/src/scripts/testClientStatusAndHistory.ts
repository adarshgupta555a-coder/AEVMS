import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { USERROLE, PaymentMethod } from "../generated/prisma/enums.js";
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

async function runClientStatusAndHistoryTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS CLIENT STATUS & SUB-RESOURCE HISTORY AUTOMATED TEST SUITE");
  console.log("================================================================================\n");

  let server: http.Server | null = null;
  let baseUrl = "";
  let initialSchemaHash = "";

  // Entity tracking sets for teardown
  const createdPaymentIds = new Set<string>();
  const createdInvoiceIds = new Set<string>();
  const createdQuotationIds = new Set<string>();
  const createdEventIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdClientIds = new Set<string>();

  // Helper for HTTP requests
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
    // SETUP: Create Test Clients & Users
    // -------------------------------------------------------------------------
    console.log("==> SETUP: Creating Test Clients, Users, and Sub-resources");
    const ts = Date.now();

    // 1. Client with Active Portal User
    const clientAPhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const clientAEmail = `client-a-${ts}@testsuite.local`;
    const clientA = await prisma.client.create({
      data: {
        name: "Acme Grand Events",
        phone: clientAPhone,
        email: clientAEmail,
        address: "100 Innovation Way",
        city: "Mumbai",
        notes: "Initial client note",
      },
    });
    createdClientIds.add(clientA.id);

    const clientAPassword = "ClientA@StrongPass123";
    const clientAPasswordHash = await hashPassword(clientAPassword);
    const userA = await prisma.user.create({
      data: {
        name: "Acme Client Admin",
        email: clientAEmail,
        passwordHash: clientAPasswordHash,
        role: USERROLE.CLIENT,
        isActive: true,
        clientId: clientA.id,
      },
    });
    createdUserIds.add(userA.id);

    // Login as Client A to obtain client token
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
    let clientAToken: string = clientALoginRes.data.data.accessToken;

    // 2. Client with NO Portal User
    const clientBPhone = `92${Math.floor(10000000 + Math.random() * 90000000)}`;
    const clientBEmail = `client-b-nouser-${ts}@testsuite.local`;
    const clientB = await prisma.client.create({
      data: {
        name: "Solo Business Entity",
        phone: clientBPhone,
        email: clientBEmail,
        address: "200 Market Street",
        city: "Pune",
        notes: "Lead client with no user portal yet",
      },
    });
    createdClientIds.add(clientB.id);

    // 3. Client C (Another Tenant with portal user for IDOR testing)
    const clientCPhone = `93${Math.floor(10000000 + Math.random() * 90000000)}`;
    const clientCEmail = `client-c-other-${ts}@testsuite.local`;
    const clientC = await prisma.client.create({
      data: {
        name: "Other Tenant Enterprises",
        phone: clientCPhone,
        email: clientCEmail,
        address: "300 External Avenue",
        city: "Delhi",
      },
    });
    createdClientIds.add(clientC.id);

    const clientCPassword = "ClientC@StrongPass123";
    const clientCPasswordHash = await hashPassword(clientCPassword);
    const userC = await prisma.user.create({
      data: {
        name: "Other Tenant Admin",
        email: clientCEmail,
        passwordHash: clientCPasswordHash,
        role: USERROLE.CLIENT,
        isActive: true,
        clientId: clientC.id,
      },
    });
    createdUserIds.add(userC.id);

    // 4. Seed Sub-resources for Client A (5 Events, 5 Quotations, 5 Invoices, 5 Payments)
    console.log("  [Setup] Seeding 5 Events, 5 Quotations, 5 Invoices, and 5 Payments for Client A...");

    for (let i = 1; i <= 5; i++) {
      // Event
      const ev = await prisma.event.create({
        data: {
          eventNumber: `EV-${ts}-${i}`,
          clientId: clientA.id,
          title: `Annual Corporate Gala Day ${i}`,
          eventType: "CORPORATE",
          eventDate: new Date(Date.now() + i * 86400000),
          createdById: admin.id,
        },
      });
      createdEventIds.add(ev.id);

      // Quotation
      const qt = await prisma.quotation.create({
        data: {
          quotationNumber: `QT-${ts}-${i}`,
          clientId: clientA.id,
          title: `Gala Equipment & Catering Estimate #${i}`,
          eventType: "CORPORATE",
          subtotal: 50000.0,
          totalAmount: 59000.0,
          createdById: admin.id,
        },
      });
      createdQuotationIds.add(qt.id);

      // Invoice
      const inv = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${ts}-${i}`,
          clientId: clientA.id,
          title: `Gala Installment Invoice #${i}`,
          invoiceDate: new Date(),
          subtotal: 50000.0,
          totalAmount: 59000.0,
          createdById: admin.id,
        },
      });
      createdInvoiceIds.add(inv.id);

      // Payment
      const pay = await prisma.payment.create({
        data: {
          paymentNumber: `PAY-${ts}-${i}`,
          clientId: clientA.id,
          amount: 25000.0,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          paymentDate: new Date(),
          recordedById: admin.id,
        },
      });
      createdPaymentIds.add(pay.id);
    }

    // Seed 1 record for Client C to test cross-tenant sub-resources
    const clientCEvent = await prisma.event.create({
      data: {
        eventNumber: `EV-OTHER-${ts}`,
        clientId: clientC.id,
        title: "Confidential Competitor Seminar",
        eventType: "CONFERENCE",
        eventDate: new Date(),
        createdById: admin.id,
      },
    });
    createdEventIds.add(clientCEvent.id);

    console.log(`  [Setup Complete] Created clients A (${clientA.id}), B (${clientB.id}), C (${clientC.id})\n`);

    // =========================================================================
    // SECTION 1: Client Status Management (PATCH /status)
    // =========================================================================
    console.log("==> SECTION 1: Client Portal Login Status Management (PATCH /status)");

    // 1.1 Admin deactivates active portal user via PATCH /api/v1/admin/clients/:clientId/status
    {
      const reasonText = "Periodic account security review & suspended pending re-audit";
      const deactivateRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          isActive: false,
          reason: reasonText,
        },
      });

      const body = deactivateRes.data;
      recordTest(
        "Section 1",
        "1.1a Admin deactivates active portal user via /api/v1/admin/clients/:clientId/status returns HTTP 200",
        deactivateRes.status === 200 && body.success === true,
        `Expected HTTP 200, got ${deactivateRes.status}`,
        body
      );

      recordTest(
        "Section 1",
        "1.1b Response flags confirm isActive=false, portalActive=false, hasPortalAccount=true",
        body?.data?.isActive === false &&
          body?.data?.portalActive === false &&
          body?.data?.hasPortalAccount === true &&
          body?.data?.user?.isActive === false,
        `Unexpected flags: ${JSON.stringify(body?.data)}`
      );

      // Verify DB User.isActive became false
      const dbUserAfterDeactivate = await prisma.user.findUnique({
        where: { id: userA.id },
      });
      recordTest(
        "Section 1",
        "1.1c Database verification: User.isActive is false in database",
        dbUserAfterDeactivate?.isActive === false,
        `Database isActive: ${dbUserAfterDeactivate?.isActive}`
      );

      // Verify all refresh tokens for user were revoked
      const remainingTokens = await prisma.refreshToken.count({
        where: { userId: userA.id },
      });
      recordTest(
        "Section 1",
        "1.1d Database verification: All user refresh tokens revoked (count=0)",
        remainingTokens === 0,
        `Found ${remainingTokens} active refresh tokens remaining in DB`
      );

      // Verify reason persisted in client notes
      const dbClientAfterDeactivate = await prisma.client.findUnique({
        where: { id: clientA.id },
      });
      recordTest(
        "Section 1",
        "1.1e Audit persistence: Reason is stored in client audit notes",
        Boolean(dbClientAfterDeactivate?.notes?.includes("Periodic account security review")),
        `Client notes: ${dbClientAfterDeactivate?.notes}`
      );

      // Security: Deactivated user cannot login
      const deactivatedLoginRes = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: {
          email: clientAEmail,
          password: clientAPassword,
        },
      });
      recordTest(
        "Section 1",
        "1.1f Deactivated portal user cannot login (returns HTTP 401 UNAUTHORIZED)",
        deactivatedLoginRes.status === 401,
        `Expected HTTP 401, got ${deactivatedLoginRes.status}`,
        deactivatedLoginRes.data
      );

      // Security: Authenticated requests using previous token rejected because user.isActive=false
      const oldTokenMeRes = await apiRequest("/api/v1/auth/me", {
        method: "GET",
        token: clientAToken,
      });
      recordTest(
        "Section 1",
        "1.1g Request with existing access token is rejected with HTTP 401 when user is inactive",
        oldTokenMeRes.status === 401,
        `Expected HTTP 401, got ${oldTokenMeRes.status}`,
        oldTokenMeRes.data
      );
    }

    // 1.2 Admin reactivates portal user
    {
      const reactivationReason = "Identity verification completed successfully. Portal access restored.";
      const reactivateRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          isActive: true,
          reason: reactivationReason,
        },
      });

      const body = reactivateRes.data;
      recordTest(
        "Section 1",
        "1.2a Admin reactivates portal user returns HTTP 200",
        reactivateRes.status === 200 && body.success === true,
        `Expected HTTP 200, got ${reactivateRes.status}`,
        body
      );

      recordTest(
        "Section 1",
        "1.2b Response flags confirm isActive=true, portalActive=true, user.isActive=true",
        body?.data?.isActive === true &&
          body?.data?.portalActive === true &&
          body?.data?.user?.isActive === true,
        `Unexpected flags: ${JSON.stringify(body?.data)}`
      );

      // DB verification
      const dbUserAfterReactivate = await prisma.user.findUnique({
        where: { id: userA.id },
      });
      recordTest(
        "Section 1",
        "1.2c Database verification: User.isActive is true in database",
        dbUserAfterReactivate?.isActive === true,
        `Database isActive: ${dbUserAfterReactivate?.isActive}`
      );

      // Client can now login successfully
      const reactivatedLoginRes = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: {
          email: clientAEmail,
          password: clientAPassword,
        },
      });
      recordTest(
        "Section 1",
        "1.2d Reactivated portal user can now login successfully (HTTP 200 OK)",
        reactivatedLoginRes.status === 200 && reactivatedLoginRes.data?.data?.accessToken !== undefined,
        `Expected HTTP 200, got ${reactivatedLoginRes.status}`,
        reactivatedLoginRes.data
      );

      // Save fresh token for subsequent tests
      if (reactivatedLoginRes.data?.data?.accessToken) {
        clientAToken = reactivatedLoginRes.data.data.accessToken;
      }
    }

    // 1.3 Verify alternate route: PATCH /api/v1/clients/:id/status
    {
      const routeAliasDeactivate = await apiRequest(`/api/v1/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          isActive: false,
          reason: "Route alias test deactivation",
        },
      });
      recordTest(
        "Section 1",
        "1.3a Route alias /api/v1/clients/:id/status successfully updates status (HTTP 200)",
        routeAliasDeactivate.status === 200 && routeAliasDeactivate.data?.data?.isActive === false,
        `Expected HTTP 200, got ${routeAliasDeactivate.status}`,
        routeAliasDeactivate.data
      );

      const routeAliasReactivate = await apiRequest(`/api/v1/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          isActive: true,
          reason: "Route alias test reactivation",
        },
      });
      recordTest(
        "Section 1",
        "1.3b Route alias /api/v1/clients/:id/status successfully reactivates (HTTP 200)",
        routeAliasReactivate.status === 200 && routeAliasReactivate.data?.data?.isActive === true,
        `Expected HTTP 200, got ${routeAliasReactivate.status}`,
        routeAliasReactivate.data
      );

      // Refresh login token
      const reLogin = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: {
          email: clientAEmail,
          password: clientAPassword,
        },
      });
      if (reLogin.data?.data?.accessToken) {
        clientAToken = reLogin.data.data.accessToken;
      }
    }

    // 1.4 Admin updates status for client who does NOT have a portal user yet
    {
      const noUserRes = await apiRequest(`/api/v1/admin/clients/${clientB.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          isActive: true,
          reason: "Activating client with no linked user",
        },
      });

      const body = noUserRes.data;
      recordTest(
        "Section 1",
        "1.4a Status update on client without portal user returns HTTP 200",
        noUserRes.status === 200 && body.success === true,
        `Expected HTTP 200, got ${noUserRes.status}`,
        body
      );

      recordTest(
        "Section 1",
        "1.4b Response explicitly sets hasPortalAccount: false and user: null",
        body?.data?.hasPortalAccount === false &&
          body?.data?.portalActive === false &&
          body?.data?.isActive === true &&
          body?.data?.user === null,
        `Unexpected data: ${JSON.stringify(body?.data)}`
      );

      // Deactivate client without portal user
      const noUserDeactivate = await apiRequest(`/api/v1/admin/clients/${clientB.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          isActive: false,
          reason: "Deactivating client with no linked user",
        },
      });
      recordTest(
        "Section 1",
        "1.4c Deactivating client without portal user returns HTTP 200 and hasPortalAccount: false",
        noUserDeactivate.status === 200 &&
          noUserDeactivate.data?.data?.hasPortalAccount === false &&
          noUserDeactivate.data?.data?.isActive === false,
        `Expected HTTP 200 with hasPortalAccount=false, got ${noUserDeactivate.status}`,
        noUserDeactivate.data
      );
    }

    // 1.5 Validation: isActive required boolean (returns 422 for non-boolean or missing)
    {
      // Missing isActive
      const missingFieldRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          reason: "Missing isActive field",
        },
      });
      recordTest(
        "Section 1",
        "1.5a Missing isActive field returns HTTP 422 VALIDATION_ERROR",
        missingFieldRes.status === 422,
        `Expected HTTP 422, got ${missingFieldRes.status}`,
        missingFieldRes.data
      );

      // Non-boolean string isActive
      const stringFieldRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          isActive: "true",
        },
      });
      recordTest(
        "Section 1",
        "1.5b Non-boolean string isActive ('true') returns HTTP 422 VALIDATION_ERROR",
        stringFieldRes.status === 422,
        `Expected HTTP 422, got ${stringFieldRes.status}`,
        stringFieldRes.data
      );

      // Non-boolean numeric isActive
      const numFieldRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {
          isActive: 1,
        },
      });
      recordTest(
        "Section 1",
        "1.5c Non-boolean number isActive (1) returns HTTP 422 VALIDATION_ERROR",
        numFieldRes.status === 422,
        `Expected HTTP 422, got ${numFieldRes.status}`,
        numFieldRes.data
      );

      // Empty body
      const emptyBodyRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: adminToken,
        body: {},
      });
      recordTest(
        "Section 1",
        "1.5d Empty request body returns HTTP 422 VALIDATION_ERROR",
        emptyBodyRes.status === 422,
        `Expected HTTP 422, got ${emptyBodyRes.status}`,
        emptyBodyRes.data
      );
    }

    // 1.6 Security: Non-admin receives 403 or 401
    {
      // Unauthenticated request to /admin/clients/:id/status
      const unauthAdminRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/status`, {
        method: "PATCH",
        body: { isActive: true },
      });
      recordTest(
        "Section 1",
        "1.6a Unauthenticated request to /admin/clients/:id/status returns HTTP 401 UNAUTHORIZED",
        unauthAdminRes.status === 401,
        `Expected HTTP 401, got ${unauthAdminRes.status}`,
        unauthAdminRes.data
      );

      // Unauthenticated request to /clients/:id/status
      const unauthClientRes = await apiRequest(`/api/v1/clients/${clientA.id}/status`, {
        method: "PATCH",
        body: { isActive: true },
      });
      recordTest(
        "Section 1",
        "1.6b Unauthenticated request to /clients/:id/status returns HTTP 401 UNAUTHORIZED",
        unauthClientRes.status === 401,
        `Expected HTTP 401, got ${unauthClientRes.status}`,
        unauthClientRes.data
      );

      // Authenticated CLIENT role attempting to change own status
      const clientRoleOwnRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: clientAToken,
        body: { isActive: true },
      });
      recordTest(
        "Section 1",
        "1.6c CLIENT role attempting /admin/clients/:id/status returns HTTP 403 FORBIDDEN",
        clientRoleOwnRes.status === 403,
        `Expected HTTP 403, got ${clientRoleOwnRes.status}`,
        clientRoleOwnRes.data
      );

      // Authenticated CLIENT role attempting to change status via /clients/:id/status
      const clientRoleAliasRes = await apiRequest(`/api/v1/clients/${clientA.id}/status`, {
        method: "PATCH",
        token: clientAToken,
        body: { isActive: true },
      });
      recordTest(
        "Section 1",
        "1.6d CLIENT role attempting /clients/:id/status returns HTTP 403 FORBIDDEN",
        clientRoleAliasRes.status === 403,
        `Expected HTTP 403, got ${clientRoleAliasRes.status}`,
        clientRoleAliasRes.data
      );

      // Authenticated CLIENT role attempting to change another client's status
      const clientRoleOtherRes = await apiRequest(`/api/v1/clients/${clientC.id}/status`, {
        method: "PATCH",
        token: clientAToken,
        body: { isActive: false },
      });
      recordTest(
        "Section 1",
        "1.6e CLIENT role attempting another client status change returns HTTP 403 FORBIDDEN",
        clientRoleOtherRes.status === 403,
        `Expected HTTP 403, got ${clientRoleOtherRes.status}`,
        clientRoleOtherRes.data
      );
    }

    // 1.7 Non-existent clientId returns 404
    {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const notFoundRes = await apiRequest(`/api/v1/admin/clients/${nonExistentId}/status`, {
        method: "PATCH",
        token: adminToken,
        body: { isActive: true },
      });
      recordTest(
        "Section 1",
        "1.7a Status update for non-existent clientId via /admin/clients/:id/status returns HTTP 404 NOT_FOUND",
        notFoundRes.status === 404,
        `Expected HTTP 404, got ${notFoundRes.status}`,
        notFoundRes.data
      );

      const notFoundAliasRes = await apiRequest(`/api/v1/clients/${nonExistentId}/status`, {
        method: "PATCH",
        token: adminToken,
        body: { isActive: true },
      });
      recordTest(
        "Section 1",
        "1.7b Status update for non-existent clientId via /clients/:id/status returns HTTP 404 NOT_FOUND",
        notFoundAliasRes.status === 404,
        `Expected HTTP 404, got ${notFoundAliasRes.status}`,
        notFoundAliasRes.data
      );
    }

    // =========================================================================
    // SECTION 2: Sub-resource History Routes & Pagination
    // =========================================================================
    console.log("\n==> SECTION 2: Sub-resource History Routes & Pagination Verification");

    const subresourceEndpoints = [
      { key: "events", label: "Events", singular: "event" },
      { key: "quotations", label: "Quotations", singular: "quotation" },
      { key: "invoices", label: "Invoices", singular: "invoice" },
      { key: "payments", label: "Payments", singular: "payment" },
    ] as const;

    for (const sub of subresourceEndpoints) {
      console.log(`\n  --- Verifying ${sub.label} History ---`);

      // 2.1 Admin access via /api/v1/admin/clients/:clientId/[resource]
      const adminSubRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/${sub.key}`, {
        method: "GET",
        token: adminToken,
      });

      const body = adminSubRes.data;
      recordTest(
        "Section 2",
        `2.1 [${sub.label}] GET /api/v1/admin/clients/:clientId/${sub.key} returns HTTP 200 OK`,
        adminSubRes.status === 200 && body.success === true,
        `Expected HTTP 200, got ${adminSubRes.status}`,
        body
      );

      // Verify response structure: { client, [resourceKey]: [], meta: { page, limit, total, totalPages } }
      const hasClientData =
        body?.data?.client !== undefined &&
        body?.data?.client?.id === clientA.id &&
        body?.data?.client?.name === clientA.name;
      const hasResourceArray = Array.isArray(body?.data?.[sub.key]);
      const hasCorrectMeta =
        body?.meta !== undefined &&
        typeof body?.meta?.page === "number" &&
        typeof body?.meta?.limit === "number" &&
        typeof body?.meta?.total === "number" &&
        typeof body?.meta?.totalPages === "number";

      recordTest(
        "Section 2",
        `2.2 [${sub.label}] Response format matches { client, ${sub.key}: [], meta: { page, limit, total, totalPages } }`,
        hasClientData && hasResourceArray && hasCorrectMeta,
        `Response structure missing required properties: client=${Boolean(body?.data?.client)}, ${sub.key}=${hasResourceArray}, meta=${hasCorrectMeta}`,
        { data: body?.data, meta: body?.meta }
      );

      // Verify alias route: GET /api/v1/clients/:id/[resource]
      const aliasSubRes = await apiRequest(`/api/v1/clients/${clientA.id}/${sub.key}`, {
        method: "GET",
        token: adminToken,
      });
      recordTest(
        "Section 2",
        `2.3 [${sub.label}] Route alias GET /api/v1/clients/:id/${sub.key} returns HTTP 200 OK`,
        aliasSubRes.status === 200 && aliasSubRes.data?.success === true,
        `Expected HTTP 200, got ${aliasSubRes.status}`
      );

      // Verify pagination: page=1&limit=2 (we seeded 5 items)
      const page1Res = await apiRequest(`/api/v1/admin/clients/${clientA.id}/${sub.key}?page=1&limit=2`, {
        method: "GET",
        token: adminToken,
      });
      const page1Body = page1Res.data;
      const page1Items = page1Body?.data?.[sub.key];
      const page1Meta = page1Body?.meta;

      recordTest(
        "Section 2",
        `2.4 [${sub.label}] Pagination page=1&limit=2 returns exactly 2 records with meta total=5, totalPages=3`,
        page1Res.status === 200 &&
          Array.isArray(page1Items) &&
          page1Items.length === 2 &&
          page1Meta?.page === 1 &&
          page1Meta?.limit === 2 &&
          page1Meta?.total === 5 &&
          page1Meta?.totalPages === 3,
        `Pagination mismatch: length=${page1Items?.length}, meta=${JSON.stringify(page1Meta)}`
      );

      // Verify pagination: page=2&limit=2
      const page2Res = await apiRequest(`/api/v1/admin/clients/${clientA.id}/${sub.key}?page=2&limit=2`, {
        method: "GET",
        token: adminToken,
      });
      const page2Body = page2Res.data;
      const page2Items = page2Body?.data?.[sub.key];
      const page2Meta = page2Body?.meta;

      recordTest(
        "Section 2",
        `2.5 [${sub.label}] Pagination page=2&limit=2 returns second page with 2 records`,
        page2Res.status === 200 &&
          Array.isArray(page2Items) &&
          page2Items.length === 2 &&
          page2Meta?.page === 2 &&
          page2Items[0]?.id !== page1Items[0]?.id,
        `Page 2 error: length=${page2Items?.length}, meta=${JSON.stringify(page2Meta)}`
      );

      // Verify pagination: page=3&limit=2 (last page, should have 1 remaining item)
      const page3Res = await apiRequest(`/api/v1/admin/clients/${clientA.id}/${sub.key}?page=3&limit=2`, {
        method: "GET",
        token: adminToken,
      });
      const page3Body = page3Res.data;
      const page3Items = page3Body?.data?.[sub.key];
      const page3Meta = page3Body?.meta;

      recordTest(
        "Section 2",
        `2.6 [${sub.label}] Pagination page=3&limit=2 returns final page with remaining 1 record`,
        page3Res.status === 200 &&
          Array.isArray(page3Items) &&
          page3Items.length === 1 &&
          page3Meta?.page === 3,
        `Page 3 error: length=${page3Items?.length}, meta=${JSON.stringify(page3Meta)}`
      );
    }

    // =========================================================================
    // SECTION 3: Sub-resource Security, IDOR Protection & RBAC
    // =========================================================================
    console.log("\n==> SECTION 3: Security, IDOR Protection & Role Access Control");

    // 3.1 Admin can access ANY client's history
    {
      const adminOtherEvents = await apiRequest(`/api/v1/admin/clients/${clientC.id}/events`, {
        method: "GET",
        token: adminToken,
      });
      recordTest(
        "Section 3",
        "3.1a Admin can access Client C's events via /admin/clients/:id/events (HTTP 200 OK)",
        adminOtherEvents.status === 200 &&
          adminOtherEvents.data?.data?.client?.id === clientC.id &&
          adminOtherEvents.data?.data?.events?.length === 1,
        `Expected HTTP 200, got ${adminOtherEvents.status}`
      );

      const adminOtherQuotations = await apiRequest(`/api/v1/clients/${clientC.id}/quotations`, {
        method: "GET",
        token: adminToken,
      });
      recordTest(
        "Section 3",
        "3.1b Admin can access Client C's quotations via /clients/:id/quotations (HTTP 200 OK)",
        adminOtherQuotations.status === 200 &&
          adminOtherQuotations.data?.data?.client?.id === clientC.id,
        `Expected HTTP 200, got ${adminOtherQuotations.status}`
      );
    }

    // 3.2 Client role can access their OWN history
    {
      for (const sub of subresourceEndpoints) {
        // Own history via /clients/:id/[resource]
        const clientOwnRes = await apiRequest(`/api/v1/clients/${clientA.id}/${sub.key}`, {
          method: "GET",
          token: clientAToken,
        });
        recordTest(
          "Section 3",
          `3.2 [${sub.label}] Client A accesses OWN ${sub.key} via /clients/:id/${sub.key} (HTTP 200 OK)`,
          clientOwnRes.status === 200 &&
            clientOwnRes.data?.data?.client?.id === clientA.id &&
            Array.isArray(clientOwnRes.data?.data?.[sub.key]),
          `Expected HTTP 200, got ${clientOwnRes.status}`,
          clientOwnRes.data
        );

        // Own history via /admin/clients/:clientId/[resource]
        const clientOwnAdminRouteRes = await apiRequest(`/api/v1/admin/clients/${clientA.id}/${sub.key}`, {
          method: "GET",
          token: clientAToken,
        });
        recordTest(
          "Section 3",
          `3.2 [${sub.label}] Client A accesses OWN ${sub.key} via /admin/clients/:clientId/${sub.key} (HTTP 200 OK)`,
          clientOwnAdminRouteRes.status === 200 &&
            clientOwnAdminRouteRes.data?.data?.client?.id === clientA.id,
          `Expected HTTP 200, got ${clientOwnAdminRouteRes.status}`
        );
      }
    }

    // 3.3 IDOR Protection: Client role accessing ANOTHER client's history receives 403 Forbidden
    {
      for (const sub of subresourceEndpoints) {
        // Client A accessing Client C's history via /clients/:id/[resource]
        const idorClientRes = await apiRequest(`/api/v1/clients/${clientC.id}/${sub.key}`, {
          method: "GET",
          token: clientAToken,
        });
        recordTest(
          "Section 3",
          `3.3 [${sub.label}] IDOR Protection: Client A accessing Client C's ${sub.key} via /clients receives HTTP 403 FORBIDDEN`,
          idorClientRes.status === 403,
          `Expected HTTP 403, got ${idorClientRes.status}`,
          idorClientRes.data
        );

        // Client A accessing Client C's history via /admin/clients/:clientId/[resource]
        const idorAdminRes = await apiRequest(`/api/v1/admin/clients/${clientC.id}/${sub.key}`, {
          method: "GET",
          token: clientAToken,
        });
        recordTest(
          "Section 3",
          `3.3 [${sub.label}] IDOR Protection: Client A accessing Client C's ${sub.key} via /admin/clients receives HTTP 403 FORBIDDEN`,
          idorAdminRes.status === 403,
          `Expected HTTP 403, got ${idorAdminRes.status}`,
          idorAdminRes.data
        );
      }
    }

    // 3.4 Non-existent clientId receives 404 Not Found
    {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      for (const sub of subresourceEndpoints) {
        const notFoundSubRes = await apiRequest(`/api/v1/admin/clients/${nonExistentId}/${sub.key}`, {
          method: "GET",
          token: adminToken,
        });
        recordTest(
          "Section 3",
          `3.4 [${sub.label}] Non-existent clientId receives HTTP 404 NOT_FOUND`,
          notFoundSubRes.status === 404,
          `Expected HTTP 404, got ${notFoundSubRes.status}`,
          notFoundSubRes.data
        );
      }
    }

    // 3.5 Unauthenticated requests receive 401 Unauthorized
    {
      for (const sub of subresourceEndpoints) {
        // Unauthenticated request to /admin/clients/:clientId/[resource]
        const unauthAdminSub = await apiRequest(`/api/v1/admin/clients/${clientA.id}/${sub.key}`, {
          method: "GET",
        });
        recordTest(
          "Section 3",
          `3.5 [${sub.label}] Unauthenticated request to /admin/clients/:id/${sub.key} returns HTTP 401 UNAUTHORIZED`,
          unauthAdminSub.status === 401,
          `Expected HTTP 401, got ${unauthAdminSub.status}`,
          unauthAdminSub.data
        );

        // Unauthenticated request to /clients/:id/[resource]
        const unauthClientSub = await apiRequest(`/api/v1/clients/${clientA.id}/${sub.key}`, {
          method: "GET",
        });
        recordTest(
          "Section 3",
          `3.5 [${sub.label}] Unauthenticated request to /clients/:id/${sub.key} returns HTTP 401 UNAUTHORIZED`,
          unauthClientSub.status === 401,
          `Expected HTTP 401, got ${unauthClientSub.status}`,
          unauthClientSub.data
        );
      }
    }
  } catch (error) {
    console.error("\x1b[31mCritical failure during test execution:\x1b[0m", error);
    recordTest("Execution", "Critical Suite Execution Error", false, String(error));
  } finally {
    // =========================================================================
    // SECTION 4: Teardown, Cleanup & Schema Integrity
    // =========================================================================
    console.log("\n==> SECTION 4: Teardown, Comprehensive Cleanup & Schema Integrity");

    try {
      // 1. Delete Payments
      if (createdPaymentIds.size > 0) {
        const delPayments = await prisma.payment.deleteMany({
          where: { id: { in: Array.from(createdPaymentIds) } },
        });
        console.log(`  [Teardown] Deleted ${delPayments.count} test Payments`);
      }

      // 2. Delete Invoices
      if (createdInvoiceIds.size > 0) {
        const delInvoices = await prisma.invoice.deleteMany({
          where: { id: { in: Array.from(createdInvoiceIds) } },
        });
        console.log(`  [Teardown] Deleted ${delInvoices.count} test Invoices`);
      }

      // 3. Delete Events
      if (createdEventIds.size > 0) {
        const delEvents = await prisma.event.deleteMany({
          where: { id: { in: Array.from(createdEventIds) } },
        });
        console.log(`  [Teardown] Deleted ${delEvents.count} test Events`);
      }

      // 4. Delete Quotations
      if (createdQuotationIds.size > 0) {
        const delQuotations = await prisma.quotation.deleteMany({
          where: { id: { in: Array.from(createdQuotationIds) } },
        });
        console.log(`  [Teardown] Deleted ${delQuotations.count} test Quotations`);
      }

      // 5. Delete RefreshTokens & Users
      if (createdUserIds.size > 0) {
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: Array.from(createdUserIds) } },
        });
        const delUsers = await prisma.user.deleteMany({
          where: { id: { in: Array.from(createdUserIds) } },
        });
        console.log(`  [Teardown] Deleted ${delUsers.count} test Users`);
      }

      // 6. Delete Clients
      if (createdClientIds.size > 0) {
        const delClients = await prisma.client.deleteMany({
          where: { id: { in: Array.from(createdClientIds) } },
        });
        console.log(`  [Teardown] Deleted ${delClients.count} test Clients`);
      }

      // Verify zero lingering test records
      const [remainingClients, remainingUsers, remainingEvents, remainingQuotations, remainingInvoices, remainingPayments] =
        await Promise.all([
          prisma.client.count({ where: { id: { in: Array.from(createdClientIds) } } }),
          prisma.user.count({ where: { id: { in: Array.from(createdUserIds) } } }),
          prisma.event.count({ where: { id: { in: Array.from(createdEventIds) } } }),
          prisma.quotation.count({ where: { id: { in: Array.from(createdQuotationIds) } } }),
          prisma.invoice.count({ where: { id: { in: Array.from(createdInvoiceIds) } } }),
          prisma.payment.count({ where: { id: { in: Array.from(createdPaymentIds) } } }),
        ]);

      const isClean =
        remainingClients === 0 &&
        remainingUsers === 0 &&
        remainingEvents === 0 &&
        remainingQuotations === 0 &&
        remainingInvoices === 0 &&
        remainingPayments === 0;

      recordTest(
        "Section 4",
        "4.1 All test data completely cleaned up in teardown (0 remaining records)",
        isClean,
        `Lingering records: clients=${remainingClients}, users=${remainingUsers}, events=${remainingEvents}, quotations=${remainingQuotations}, invoices=${remainingInvoices}, payments=${remainingPayments}`
      );
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
      recordTest("Section 4", "4.1 All test data completely cleaned up in teardown", false, String(cleanupErr));
    }

    // 4.2 Schema integrity check: Verify backend/prisma/schema.prisma has not been modified
    const finalSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    const schemaIsUntouched = initialSchemaHash !== "" && initialSchemaHash === finalSchemaHash;
    recordTest(
      "Section 4",
      "4.2 backend/prisma/schema.prisma has NOT been modified (SHA-256 match)",
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
    console.log("\nALL CLIENT STATUS & SUB-RESOURCE HISTORY TESTS PASSED WITH 100% SUCCESS RATE!\n");
    process.exit(0);
  }
}

runClientStatusAndHistoryTestSuite().catch((err) => {
  console.error("Unhandled test suite failure:", err);
  process.exit(1);
});
