import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { USERROLE } from "../generated/prisma/enums.js";
import { hashPassword, comparePassword } from "../utils/password.js";

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

function parseSetCookie(headers: Headers): Record<string, { value: string; flags: string[] }> {
  const cookieHeaders = typeof (headers as any).getSetCookie === "function"
    ? (headers as any).getSetCookie()
    : [headers.get("set-cookie") ?? ""].filter(Boolean);

  const cookies: Record<string, { value: string; flags: string[] }> = {};
  for (const header of cookieHeaders) {
    const parts = header.split(";").map((p: string) => p.trim());
    if (parts.length > 0 && parts[0]) {
      const eqIdx = parts[0].indexOf("=");
      if (eqIdx !== -1) {
        const key = parts[0].substring(0, eqIdx);
        const val = parts[0].substring(eqIdx + 1);
        cookies[key] = { value: val, flags: parts.slice(1) };
      }
    }
  }
  return cookies;
}

async function runPortalTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS CLIENT PORTAL ASSIGNMENT & ACTIVATION WORKFLOW TEST SUITE");
  console.log("================================================================================\n");

  let server: http.Server | null = null;
  let baseUrl = "";

  // Tracking sets for bulletproof teardown
  const createdClientIds = new Set<string>();
  const createdUserIds = new Set<string>();

  // Helper for API requests
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
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    return { status: res.status, data, headers: res.headers };
  }

  let initialSchemaHash = "";

  try {
    // -------------------------------------------------------------------------
    // Record schema.prisma hash for untouched schema verification
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
    // Setup: Admin Authentication
    // -------------------------------------------------------------------------
    console.log("==> SETUP: Authenticating Administrator");

    // Ensure administrator exists
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

    // =========================================================================
    // STEP 1: Admin Creates a Client (POST /api/v1/clients)
    // =========================================================================
    console.log("==> STEP 1: Admin creates a Client (POST /api/v1/clients)");
    const clientTimestamp = Date.now();
    const clientEmail = `portal-test-${clientTimestamp}@clientdomain.local`;
    const clientPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    let clientId = "";
    let clientRecord: any = null;

    {
      const createRes = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Grand Horizon Events",
          phone: clientPhone,
          email: clientEmail,
          address: "42 Marina Boulevard, Suite 500",
          city: "Mumbai",
          notes: "Corporate client requiring self-service portal access",
        },
      });

      clientRecord = createRes.data?.data;
      if (clientRecord?.id) {
        clientId = clientRecord.id;
        createdClientIds.add(clientId);
      }

      // 1.1 Verify ONLY client profile is created (status 201)
      recordTest(
        "Step 1",
        "1.1 Admin creates client profile successfully with HTTP 201 CREATED",
        createRes.status === 201 &&
          createRes.data?.success === true &&
          clientRecord?.id !== undefined &&
          clientRecord?.name === "Grand Horizon Events" &&
          clientRecord?.email === clientEmail.toLowerCase(),
        `Expected 201, received: ${createRes.status}`,
        createRes.data
      );

      // 1.2 Verify NO User record exists in API response (client.user is null)
      recordTest(
        "Step 1",
        "1.2 API response confirms NO User account created (client.user is null)",
        clientRecord?.user === null,
        `Expected client.user to be null, received: ${JSON.stringify(clientRecord?.user)}`
      );

      // 1.3 Verify NO User record exists for this client in database
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [{ clientId: clientId }, { email: clientEmail.toLowerCase() }],
        },
      });
      recordTest(
        "Step 1",
        "1.3 Database check confirms NO User record exists for this client (null)",
        dbUser === null,
        `Found unexpected User record in DB: ${JSON.stringify(dbUser)}`
      );

      // 1.4 Verify GET /api/v1/clients/:id/portal-status returns "NOT_ASSIGNED"
      const statusRes = await apiRequest(`/api/v1/clients/${clientId}/portal-status`, {
        method: "GET",
        token: adminToken,
      });

      recordTest(
        "Step 1",
        "1.4 GET /api/v1/clients/:id/portal-status returns 'NOT_ASSIGNED' with canAssign=true",
        statusRes.status === 200 &&
          statusRes.data?.success === true &&
          statusRes.data?.data?.status === "NOT_ASSIGNED" &&
          statusRes.data?.data?.canAssign === true,
        `Expected status 'NOT_ASSIGNED', received: ${statusRes.data?.data?.status}`,
        statusRes.data
      );

      // 1.5 Security: Unauthenticated request to portal-status rejected with HTTP 401
      const unauthStatusRes = await apiRequest(`/api/v1/clients/${clientId}/portal-status`, {
        method: "GET",
      });
      recordTest(
        "Step 1",
        "1.5 Unauthenticated request to portal-status returns HTTP 401 UNAUTHORIZED",
        unauthStatusRes.status === 401,
        `Expected 401, received: ${unauthStatusRes.status}`
      );
    }

    // =========================================================================
    // STEP 2: Admin Assigns Client Portal (POST /api/v1/clients/:id/assign-portal)
    // =========================================================================
    console.log("\n==> STEP 2: Admin assigns Client Portal (POST /api/v1/clients/:id/assign-portal)");
    let initialInvitationToken = "";
    let initialInvitationExpiresAt: Date | null = null;
    let portalUserId = "";

    {
      // 2.1 Verify assigning to client with no email returns 400 Bad Request
      const clientWithoutEmailPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
      const clientNoEmailRes = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Client Without Email Co",
          phone: clientWithoutEmailPhone,
          email: "",
        },
      });

      const clientNoEmailId = clientNoEmailRes.data?.data?.id;
      if (clientNoEmailId) {
        createdClientIds.add(clientNoEmailId);

        // Verify status for client without email shows canAssign=false
        const noEmailStatusRes = await apiRequest(`/api/v1/clients/${clientNoEmailId}/portal-status`, {
          method: "GET",
          token: adminToken,
        });
        recordTest(
          "Step 2",
          "2.1a GET portal-status for client with no email returns NOT_ASSIGNED and canAssign=false",
          noEmailStatusRes.status === 200 &&
            noEmailStatusRes.data?.data?.status === "NOT_ASSIGNED" &&
            noEmailStatusRes.data?.data?.canAssign === false,
          `Received: ${JSON.stringify(noEmailStatusRes.data)}`
        );

        // Attempt portal assignment to client without email -> HTTP 400
        const assignNoEmailRes = await apiRequest(`/api/v1/clients/${clientNoEmailId}/assign-portal`, {
          method: "POST",
          token: adminToken,
          body: {},
        });

        recordTest(
          "Step 2",
          "2.1b Assigning portal to client with no email returns HTTP 400 BAD_REQUEST",
          assignNoEmailRes.status === 400 &&
            assignNoEmailRes.data?.error?.code === "BAD_REQUEST",
          `Expected 400, received: ${assignNoEmailRes.status}`,
          assignNoEmailRes.data
        );
      }

      // 2.2 Admin assigns portal to existing client with email
      const assignRes = await apiRequest(`/api/v1/clients/${clientId}/assign-portal`, {
        method: "POST",
        token: adminToken,
        body: {
          expiresInHours: 48,
        },
      });

      const assignData = assignRes.data?.data;
      initialInvitationToken = assignData?.invitationToken;
      portalUserId = assignData?.user?.id;
      if (portalUserId) {
        createdUserIds.add(portalUserId);
      }

      recordTest(
        "Step 2",
        "2.2 Admin assigns portal to existing client with email successfully (HTTP 201 CREATED)",
        assignRes.status === 201 &&
          assignRes.data?.success === true &&
          assignData?.portalStatus === "INVITATION_PENDING",
        `Expected 201, received: ${assignRes.status}`,
        assignRes.data
      );

      // 2.3 Verify invitation token is returned and activation URL generated
      recordTest(
        "Step 2",
        "2.3 Invitation token returned (64-char hex) and activationUrl contains token",
        typeof initialInvitationToken === "string" &&
          initialInvitationToken.length === 64 &&
          typeof assignData?.activationUrl === "string" &&
          assignData.activationUrl.includes(initialInvitationToken),
        `invitationToken: ${initialInvitationToken}`
      );

      // 2.4 Verify User record in DB has role="CLIENT", isActive=false, invitationToken, and invitationExpiresAt
      const dbUserRecord = await prisma.user.findUnique({
        where: { id: portalUserId },
      });

      if (dbUserRecord?.invitationExpiresAt) {
        initialInvitationExpiresAt = new Date(dbUserRecord.invitationExpiresAt);
      }

      const isFutureExpiry =
        initialInvitationExpiresAt !== null &&
        initialInvitationExpiresAt.getTime() > Date.now();

      recordTest(
        "Step 2",
        "2.4 Database User record has role='CLIENT', isActive=false, invitationToken, and invitationExpiresAt",
        dbUserRecord !== null &&
          dbUserRecord.role === USERROLE.CLIENT &&
          dbUserRecord.isActive === false &&
          dbUserRecord.invitationToken === initialInvitationToken &&
          dbUserRecord.passwordHash === "$locked_pending_activation$" &&
          dbUserRecord.clientId === clientId &&
          Boolean(isFutureExpiry),
        `dbUserRecord: ${JSON.stringify(dbUserRecord)}`
      );

      // 2.5 Verify assigning again while already assigned returns 409 Conflict
      const assignAgainRes = await apiRequest(`/api/v1/clients/${clientId}/assign-portal`, {
        method: "POST",
        token: adminToken,
        body: {},
      });

      recordTest(
        "Step 2",
        "2.5 Assigning portal again while already assigned returns HTTP 409 CONFLICT",
        assignAgainRes.status === 409 &&
          assignAgainRes.data?.error?.code === "CONFLICT",
        `Expected 409 CONFLICT, received: ${assignAgainRes.status}`,
        assignAgainRes.data
      );

      // 2.6 Verify GET /api/v1/clients/:id/portal-status returns "INVITATION_PENDING"
      const pendingStatusRes = await apiRequest(`/api/v1/clients/${clientId}/portal-status`, {
        method: "GET",
        token: adminToken,
      });

      recordTest(
        "Step 2",
        "2.6 GET /api/v1/clients/:id/portal-status returns 'INVITATION_PENDING' with canResend=true",
        pendingStatusRes.status === 200 &&
          pendingStatusRes.data?.data?.status === "INVITATION_PENDING" &&
          pendingStatusRes.data?.data?.canResend === true,
        `Expected 'INVITATION_PENDING', received: ${pendingStatusRes.data?.data?.status}`,
        pendingStatusRes.data
      );

      // 2.7 Security: Pre-activation login attempt is rejected with 401 Unauthorized
      const preActivateLoginRes = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: {
          email: clientEmail,
          password: "AnyPassword123!",
        },
      });

      recordTest(
        "Step 2",
        "2.7 Client cannot authenticate before activation (HTTP 401 UNAUTHORIZED)",
        preActivateLoginRes.status === 401,
        `Expected 401, received: ${preActivateLoginRes.status}`
      );
    }

    // =========================================================================
    // STEP 3: Admin Resends Invitation (POST /api/v1/clients/:id/resend-invite)
    // =========================================================================
    console.log("\n==> STEP 3: Admin resends invitation (POST /api/v1/clients/:id/resend-invite)");
    let freshInvitationToken = "";
    let freshInvitationExpiresAt: Date | null = null;

    {
      // 3.1 Unauthenticated resend-invite is blocked (HTTP 401)
      const unauthResend = await apiRequest(`/api/v1/clients/${clientId}/resend-invite`, {
        method: "POST",
      });
      recordTest(
        "Step 3",
        "3.1 Unauthenticated request to resend-invite returns HTTP 401 UNAUTHORIZED",
        unauthResend.status === 401,
        `Expected 401, received: ${unauthResend.status}`
      );

      // 3.2 Admin resends invitation successfully
      const resendRes = await apiRequest(`/api/v1/clients/${clientId}/resend-invite`, {
        method: "POST",
        token: adminToken,
        body: {
          expiresInHours: 72,
        },
      });

      const resendData = resendRes.data?.data;
      freshInvitationToken = resendData?.invitationToken;

      recordTest(
        "Step 3",
        "3.2 Admin successfully resends invitation via POST /api/v1/clients/:id/resend-invite (HTTP 200 OK)",
        resendRes.status === 200 &&
          resendRes.data?.success === true &&
          resendData?.portalStatus === "INVITATION_PENDING",
        `Expected 200, received: ${resendRes.status}`,
        resendRes.data
      );

      // 3.3 Verify fresh invitationToken is different from original token
      recordTest(
        "Step 3",
        "3.3 Fresh invitation token is generated and differs from original token",
        typeof freshInvitationToken === "string" &&
          freshInvitationToken.length === 64 &&
          freshInvitationToken !== initialInvitationToken,
        `initial: ${initialInvitationToken}, fresh: ${freshInvitationToken}`
      );

      // 3.4 Verify database reflects fresh token and updated expiration
      const dbUserAfterResend = await prisma.user.findUnique({
        where: { id: portalUserId },
      });

      if (dbUserAfterResend?.invitationExpiresAt) {
        freshInvitationExpiresAt = new Date(dbUserAfterResend.invitationExpiresAt);
      }

      recordTest(
        "Step 3",
        "3.4 Database User record updated with fresh invitationToken and future expiration",
        dbUserAfterResend?.invitationToken === freshInvitationToken &&
          freshInvitationExpiresAt !== null &&
          freshInvitationExpiresAt.getTime() > Date.now(),
        `dbUserAfterResend: ${JSON.stringify(dbUserAfterResend)}`
      );

      // 3.5 Security: Verify old invitation token no longer works (HTTP 400 Bad Request)
      const oldTokenActivationRes = await apiRequest("/api/v1/auth/activate-portal", {
        method: "POST",
        body: {
          token: initialInvitationToken,
          password: "OldTokenAttempt@2026",
        },
      });

      recordTest(
        "Step 3",
        "3.5 Replayed old invitation token is rejected with HTTP 400 BAD_REQUEST",
        oldTokenActivationRes.status === 400 &&
          oldTokenActivationRes.data?.error?.code === "BAD_REQUEST",
        `Expected 400, received: ${oldTokenActivationRes.status}`,
        oldTokenActivationRes.data
      );
    }

    // =========================================================================
    // STEP 4: Client Activates Portal (POST /api/v1/auth/activate-portal)
    // =========================================================================
    console.log("\n==> STEP 4: Client activates portal (POST /api/v1/auth/activate-portal)");
    const clientChosenPassword = "ClientSecurePassword@2026!";
    let clientAccessToken = "";
    let clientSessionCookies: Record<string, { value: string; flags: string[] }> = {};

    {
      // 4.1 Rejection with completely invalid token (HTTP 400 Bad Request)
      const invalidTokenRes = await apiRequest("/api/v1/auth/activate-portal", {
        method: "POST",
        body: {
          token: "0000000000000000000000000000000000000000000000000000000000000000",
          password: clientChosenPassword,
        },
      });

      recordTest(
        "Step 4",
        "4.1 Rejection with non-existent token returns HTTP 400 BAD_REQUEST",
        invalidTokenRes.status === 400 &&
          invalidTokenRes.data?.error?.code === "BAD_REQUEST",
        `Expected 400, received: ${invalidTokenRes.status}`,
        invalidTokenRes.data
      );

      // 4.2 Rejection with weak password (< 6 characters) -> HTTP 422
      const shortPasswordRes = await apiRequest("/api/v1/auth/activate-portal", {
        method: "POST",
        body: {
          token: freshInvitationToken,
          password: "123",
        },
      });

      recordTest(
        "Step 4",
        "4.2 Rejection with password < 6 characters returns HTTP 422 VALIDATION_ERROR",
        shortPasswordRes.status === 422 &&
          shortPasswordRes.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${shortPasswordRes.status}`,
        shortPasswordRes.data
      );

      // 4.3 Successful client portal activation with freshToken
      const activateRes = await apiRequest("/api/v1/auth/activate-portal", {
        method: "POST",
        body: {
          token: freshInvitationToken,
          password: clientChosenPassword,
        },
      });

      clientSessionCookies = parseSetCookie(activateRes.headers);
      clientAccessToken = activateRes.data?.data?.accessToken;

      recordTest(
        "Step 4",
        "4.3 Client successfully activates portal with valid token and password (HTTP 200 OK)",
        activateRes.status === 200 &&
          activateRes.data?.success === true &&
          activateRes.data?.data?.user?.isActive === true,
        `Expected 200, received: ${activateRes.status}`,
        activateRes.data
      );

      // 4.4 Verify client receives authentication cookies (access_token and refresh_token)
      const hasAccessCookie = Boolean(clientSessionCookies["access_token"]?.value);
      const hasRefreshCookie = Boolean(clientSessionCookies["refresh_token"]?.value);
      const isHttpOnly =
        clientSessionCookies["access_token"]?.flags.some((f) => f.toLowerCase() === "httponly") &&
        clientSessionCookies["refresh_token"]?.flags.some((f) => f.toLowerCase() === "httponly");

      recordTest(
        "Step 4",
        "4.4 Client immediately receives secure HttpOnly authentication cookies",
        hasAccessCookie && hasRefreshCookie && Boolean(isHttpOnly),
        `Cookies found: ${JSON.stringify(clientSessionCookies)}`
      );

      // 4.5 Verify User passwordHash is updated with valid bcrypt hash
      const activatedDbUser = await prisma.user.findUnique({
        where: { id: portalUserId },
      });

      const isBcrypt =
        typeof activatedDbUser?.passwordHash === "string" &&
        (activatedDbUser.passwordHash.startsWith("$2a$") ||
          activatedDbUser.passwordHash.startsWith("$2b$"));

      const passwordMatches =
        activatedDbUser?.passwordHash !== undefined &&
        (await comparePassword(clientChosenPassword, activatedDbUser.passwordHash));

      const isNotPlaintext = activatedDbUser?.passwordHash !== clientChosenPassword;

      recordTest(
        "Step 4",
        "4.5 User passwordHash is updated with salted bcrypt hash (verified with comparePassword)",
        Boolean(isBcrypt) && Boolean(passwordMatches) && isNotPlaintext,
        `passwordHash: ${activatedDbUser?.passwordHash}`
      );

      // 4.6 Verify User.isActive becomes true
      recordTest(
        "Step 4",
        "4.6 Database User.isActive is now true",
        activatedDbUser?.isActive === true,
        `User isActive: ${activatedDbUser?.isActive}`
      );

      // 4.7 Verify User.invitationToken and User.invitationExpiresAt are cleared (single-use)
      recordTest(
        "Step 4",
        "4.7 User.invitationToken and User.invitationExpiresAt are cleared to null (single-use guarantee)",
        activatedDbUser?.invitationToken === null &&
          activatedDbUser?.invitationExpiresAt === null,
        `Token: ${activatedDbUser?.invitationToken}, ExpiresAt: ${activatedDbUser?.invitationExpiresAt}`
      );

      // 4.8 Verify re-submitting the same activation token returns 400 Bad Request
      const reActivateRes = await apiRequest("/api/v1/auth/activate-portal", {
        method: "POST",
        body: {
          token: freshInvitationToken,
          password: "AnotherPassword123!",
        },
      });

      recordTest(
        "Step 4",
        "4.8 Re-submitting the used activation token is rejected with HTTP 400 BAD_REQUEST",
        reActivateRes.status === 400 &&
          reActivateRes.data?.error?.code === "BAD_REQUEST",
        `Expected 400, received: ${reActivateRes.status}`,
        reActivateRes.data
      );
    }

    // =========================================================================
    // STEP 5: Portal Status after Activation & Client Login
    // =========================================================================
    console.log("\n==> STEP 5: Portal Status after activation & Client Login");
    {
      // 5.1 Verify GET /api/v1/clients/:id/portal-status returns "ACTIVE"
      const activeStatusRes = await apiRequest(`/api/v1/clients/${clientId}/portal-status`, {
        method: "GET",
        token: adminToken,
      });

      recordTest(
        "Step 5",
        "5.1 GET /api/v1/clients/:id/portal-status returns 'ACTIVE' with active operational message",
        activeStatusRes.status === 200 &&
          activeStatusRes.data?.data?.status === "ACTIVE" &&
          activeStatusRes.data?.data?.user?.isActive === true,
        `Expected 'ACTIVE', received: ${activeStatusRes.data?.data?.status}`,
        activeStatusRes.data
      );

      // 5.2 Verify resend-invite on active user returns 400 Bad Request
      const resendOnActiveRes = await apiRequest(`/api/v1/clients/${clientId}/resend-invite`, {
        method: "POST",
        token: adminToken,
        body: {},
      });

      recordTest(
        "Step 5",
        "5.2 Resend-invite on active user returns HTTP 400 BAD_REQUEST",
        resendOnActiveRes.status === 400 &&
          resendOnActiveRes.data?.error?.code === "BAD_REQUEST",
        `Expected 400, received: ${resendOnActiveRes.status}`,
        resendOnActiveRes.data
      );

      // 5.3 Verify assign-portal on active user returns 409 Conflict
      const assignOnActiveRes = await apiRequest(`/api/v1/clients/${clientId}/assign-portal`, {
        method: "POST",
        token: adminToken,
        body: {},
      });

      recordTest(
        "Step 5",
        "5.3 Assign-portal on already active user returns HTTP 409 CONFLICT",
        assignOnActiveRes.status === 409 &&
          assignOnActiveRes.data?.error?.code === "CONFLICT",
        `Expected 409, received: ${assignOnActiveRes.status}`,
        assignOnActiveRes.data
      );

      // 5.4 Verify client can log in normally with new password via POST /api/v1/auth/login
      const clientLoginRes = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: {
          email: clientEmail,
          password: clientChosenPassword,
        },
      });

      const newLoginToken = clientLoginRes.data?.data?.accessToken;
      const clientUserObj = clientLoginRes.data?.data?.user;

      recordTest(
        "Step 5",
        "5.4 Client logs in normally with new password via POST /api/v1/auth/login (HTTP 200 OK)",
        clientLoginRes.status === 200 &&
          clientLoginRes.data?.success === true &&
          typeof newLoginToken === "string" &&
          clientUserObj?.role === "CLIENT" &&
          clientUserObj?.clientId === clientId,
        `Expected 200, received: ${clientLoginRes.status}`,
        clientLoginRes.data
      );

      // 5.5 Verify client can access protected /api/v1/auth/me with newly issued session
      const meRes = await apiRequest("/api/v1/auth/me", {
        method: "GET",
        token: newLoginToken,
      });

      recordTest(
        "Step 5",
        "5.5 Client accesses GET /api/v1/auth/me successfully with role=CLIENT and client details",
        meRes.status === 200 &&
          meRes.data?.data?.user?.role === "CLIENT" &&
          meRes.data?.data?.user?.clientId === clientId,
        `Expected 200, received: ${meRes.status}`,
        meRes.data
      );

      // 5.6 Verify client can access their own Client profile
      const ownClientProfileRes = await apiRequest(`/api/v1/clients/${clientId}`, {
        method: "GET",
        token: newLoginToken,
      });

      recordTest(
        "Step 5",
        "5.6 Client can view their own client profile via GET /api/v1/clients/:id (HTTP 200 OK)",
        ownClientProfileRes.status === 200 &&
          ownClientProfileRes.data?.data?.id === clientId,
        `Expected 200, received: ${ownClientProfileRes.status}`
      );

      // 5.7 IDOR Protection: Client cannot view another client's profile (HTTP 403 Forbidden)
      const dummyOtherClientId = "00000000-0000-0000-0000-000000000001";
      const otherProfileRes = await apiRequest(`/api/v1/clients/${dummyOtherClientId}`, {
        method: "GET",
        token: newLoginToken,
      });

      recordTest(
        "Step 5",
        "5.7 IDOR Protection: Client blocked from viewing another client's profile (HTTP 403 FORBIDDEN)",
        otherProfileRes.status === 403,
        `Expected 403, received: ${otherProfileRes.status}`
      );
    }

  } catch (err: any) {
    console.error("\n[Test Suite Fatal Error]:", err);
    recordTest("Fatal", "Test suite execution completed without uncaught exception", false, err.message);
  } finally {
    // =========================================================================
    // STEP 6: Teardown, Cleanup & Schema Integrity
    // =========================================================================
    console.log("\n==> STEP 6: Teardown, Cleanup & Schema Integrity");

    // 6.1 Clean up created test users and tokens
    for (const uid of createdUserIds) {
      try {
        await prisma.refreshToken.deleteMany({ where: { userId: uid } });
        await prisma.user.delete({ where: { id: uid } });
        console.log(`  [Teardown] Deleted test User: ${uid}`);
      } catch (err: any) {
        console.error(`  [Teardown] Error deleting test user ${uid}: ${err.message}`);
      }
    }

    // 6.2 Clean up created test clients
    for (const cid of createdClientIds) {
      try {
        await prisma.client.delete({ where: { id: cid } });
        console.log(`  [Teardown] Deleted test Client: ${cid}`);
      } catch (err: any) {
        console.error(`  [Teardown] Error deleting test client ${cid}: ${err.message}`);
      }
    }

    // Verify database is completely clean of test artifacts
    const remainingUsers = await prisma.user.count({
      where: { id: { in: Array.from(createdUserIds) } },
    });
    const remainingClients = await prisma.client.count({
      where: { id: { in: Array.from(createdClientIds) } },
    });

    recordTest(
      "Step 6",
      "6.1 All test clients and users completely cleaned up from database",
      remainingUsers === 0 && remainingClients === 0,
      `Remaining: ${remainingUsers} users, ${remainingClients} clients`
    );

    // 6.2 Schema integrity check: Verify schema.prisma is 100% untouched
    const finalSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    const schemaIsUntouched = initialSchemaHash !== "" && initialSchemaHash === finalSchemaHash;

    recordTest(
      "Step 6",
      "6.2 Database schema remains 100% clean and untouched (SHA-256 match)",
      schemaIsUntouched,
      `Hash mismatch: initial=${initialSchemaHash}, final=${finalSchemaHash}`
    );

    // Shutdown test server & disconnect prisma
    if (server) {
      await new Promise<void>((resolve) => {
        (server as http.Server).close(() => {
          resolve();
        });
      });
      console.log("\n[Test Server] Ephemeral HTTP Server stopped.");
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
    console.log("\nALL CLIENT PORTAL WORKFLOW TESTS PASSED PERFECTLY WITH 100% SUCCESS RATE!\n");
    process.exit(0);
  }
}

runPortalTestSuite().catch((err) => {
  console.error("Unhandled portal test suite failure:", err);
  process.exit(1);
});
