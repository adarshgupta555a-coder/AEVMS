import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { USERROLE } from "../generated/prisma/enums.js";
import { hashPassword } from "../utils/password.js";

// Expected SHA-256 hash of backend/prisma/schema.prisma before and after test
const SCHEMA_PRISMA_PATH = path.resolve(process.cwd(), "prisma/schema.prisma");
const EXPECTED_SCHEMA_HASH = "03804FCD11CF0FC75DDEB91791F472B2C3813094B31714B7952121813F997509";

interface TestResult {
  name: string;
  section: string;
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

async function runTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS PHASE 3 CLIENT MANAGEMENT MODULE QUALITY & SECURITY TEST SUITE");
  console.log("================================================================================\n");

  let server: http.Server | null = null;
  let baseUrl = "";

  // Tracking sets for teardown
  const createdClientIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdEventIds = new Set<string>();
  const createdInvoiceIds = new Set<string>();

  // Helper for API requests
  async function apiRequest(
    urlPath: string,
    options: {
      method?: string;
      token?: string;
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

  try {
    // -------------------------------------------------------------------------
    // Verify schema.prisma is pristine before starting
    // -------------------------------------------------------------------------
    const initialSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    if (initialSchemaHash !== EXPECTED_SCHEMA_HASH) {
      throw new Error(`CRITICAL ARCHITECTURAL RULE VIOLATION: schema.prisma hash mismatch before test! Got: ${initialSchemaHash}`);
    }

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
    // Setup: Admin Authentication & Client User Authentication
    // -------------------------------------------------------------------------
    console.log("==> SETUP: Authenticating Test Actors");

    // 1. Authenticate Admin
    const adminLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: "admin@ems.local",
        password: "Admin@123456",
      },
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.data?.data?.accessToken) {
      throw new Error(`Failed to login as admin: ${JSON.stringify(adminLoginRes.data)}`);
    }

    const adminToken: string = adminLoginRes.data.data.accessToken;
    const adminUser = adminLoginRes.data.data.user;
    console.log(`  [Admin Authenticated] ID: ${adminUser.id}, Email: ${adminUser.email}`);

    // =========================================================================
    // SECTION 1: Client Validation & Schema Integrity
    // =========================================================================
    console.log("\n==> SECTION 1: Client Validation & Schema Integrity");
    {
      const validBaseClient = {
        name: "Acme Corporation",
        phone: "9876543210",
        email: "contact@acme.local",
        city: "Mumbai",
        address: "123 Nariman Point",
        notes: "VIP Client",
      };

      // 1.1 Phone validation: Reject phone with < 10 digits (9 digits) -> HTTP 422
      const resShortPhone = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, phone: "987654321" },
      });
      recordTest(
        "Section 1",
        "1.1 Phone validation: Reject non-10-digit phone (< 10 digits) with HTTP 422 VALIDATION_ERROR",
        resShortPhone.status === 422 && resShortPhone.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resShortPhone.status}`,
        resShortPhone.data
      );

      // 1.2 Phone validation: Reject phone with > 10 digits (11 digits) -> HTTP 422
      const resLongPhone = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, phone: "98765432100" },
      });
      recordTest(
        "Section 1",
        "1.2 Phone validation: Reject non-10-digit phone (> 10 digits) with HTTP 422 VALIDATION_ERROR",
        resLongPhone.status === 422 && resLongPhone.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resLongPhone.status}`,
        resLongPhone.data
      );

      // 1.3 Phone validation: Reject phone with invalid Indian prefix starting with '1' -> HTTP 422
      const resPrefix1 = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, phone: "1234567890" },
      });
      recordTest(
        "Section 1",
        "1.3 Phone validation: Reject invalid Indian prefix (starts with '1') with HTTP 422 VALIDATION_ERROR",
        resPrefix1.status === 422 && resPrefix1.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resPrefix1.status}`,
        resPrefix1.data
      );

      // 1.4 Phone validation: Reject phone with invalid Indian prefix starting with '5' -> HTTP 422
      const resPrefix5 = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, phone: "5876543210" },
      });
      recordTest(
        "Section 1",
        "1.4 Phone validation: Reject invalid Indian prefix (starts with '5') with HTTP 422 VALIDATION_ERROR",
        resPrefix5.status === 422 && resPrefix5.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resPrefix5.status}`,
        resPrefix5.data
      );

      // 1.5 Phone validation: Reject phone with non-numeric characters -> HTTP 422
      const resAlphaPhone = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, phone: "98765abcde" },
      });
      recordTest(
        "Section 1",
        "1.5 Phone validation: Reject phone with non-numeric characters with HTTP 422 VALIDATION_ERROR",
        resAlphaPhone.status === 422 && resAlphaPhone.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resAlphaPhone.status}`,
        resAlphaPhone.data
      );

      // 1.6 Email validation: Reject malformed email without '@' or domain -> HTTP 422
      const resMalformedEmail = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, email: "invalid-email-string" },
      });
      recordTest(
        "Section 1",
        "1.6 Email validation: Reject malformed email with HTTP 422 VALIDATION_ERROR",
        resMalformedEmail.status === 422 && resMalformedEmail.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resMalformedEmail.status}`,
        resMalformedEmail.data
      );

      // 1.7 Email validation: Reject email missing domain (e.g. 'user@') -> HTTP 422
      const resIncompleteEmail = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, email: "contact@" },
      });
      recordTest(
        "Section 1",
        "1.7 Email validation: Reject incomplete email ('contact@') with HTTP 422 VALIDATION_ERROR",
        resIncompleteEmail.status === 422 && resIncompleteEmail.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resIncompleteEmail.status}`,
        resIncompleteEmail.data
      );

      // 1.8 Name validation: Reject short name (< 2 chars) -> HTTP 422
      const resShortName = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, name: "A" },
      });
      recordTest(
        "Section 1",
        "1.8 Name validation: Reject short name (< 2 characters) with HTTP 422 VALIDATION_ERROR",
        resShortName.status === 422 && resShortName.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resShortName.status}`,
        resShortName.data
      );

      // 1.9 Name validation: Reject whitespace-only name -> HTTP 422
      const resWhitespaceName = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: { ...validBaseClient, name: "   " },
      });
      recordTest(
        "Section 1",
        "1.9 Name validation: Reject whitespace-only name with HTTP 422 VALIDATION_ERROR",
        resWhitespaceName.status === 422 && resWhitespaceName.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resWhitespaceName.status}`,
        resWhitespaceName.data
      );
    }

    // =========================================================================
    // SECTION 2: Client Creation API (POST /api/v1/clients)
    // =========================================================================
    console.log("\n==> SECTION 2: Client Creation API (POST /api/v1/clients)");
    let client1Id = "";
    let client1Email = `client1-${Date.now()}@test.local`;
    let clientUserToken = "";
    let clientUserClientId = "";
    let clientUserId = "";

    {
      // 2.1 Unauthenticated request receives 401 Unauthorized
      const resUnauth = await apiRequest("/api/v1/clients", {
        method: "POST",
        body: {
          name: "Unauthenticated Test Client",
          phone: "9876543210",
        },
      });
      recordTest(
        "Section 2",
        "2.1 Unauthenticated request receives HTTP 401 UNAUTHORIZED",
        resUnauth.status === 401 && resUnauth.data?.success === false,
        `Expected 401, received: ${resUnauth.status}`,
        resUnauth.data
      );

      // 2.2 Admin can create a client successfully (201 Created)
      const resCreateAdmin = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Global Tech Solutions",
          phone: "9876500001",
          email: client1Email,
          address: "100 Cyber City, Sector 29",
          city: "Gurugram",
          notes: "Key enterprise client for corporate retreats",
        },
      });

      const client1 = resCreateAdmin.data?.data;
      if (client1?.id) {
        client1Id = client1.id;
        createdClientIds.add(client1Id);
      }

      const hasExpectedFields =
        client1?.id &&
        client1?.name === "Global Tech Solutions" &&
        client1?.phone === "9876500001" &&
        client1?.email === client1Email.toLowerCase() &&
        client1?.city === "Gurugram" &&
        client1?.address === "100 Cyber City, Sector 29" &&
        client1?.notes === "Key enterprise client for corporate retreats" &&
        client1?.createdAt &&
        client1?._count !== undefined;

      recordTest(
        "Section 2",
        "2.2 Admin can create a client successfully (HTTP 201 CREATED) with complete attributes",
        resCreateAdmin.status === 201 && resCreateAdmin.data?.success === true && Boolean(hasExpectedFields),
        `Expected 201 with populated client, received: ${resCreateAdmin.status}`,
        resCreateAdmin.data
      );

      // 2.3 Duplicate client email triggers 409 Conflict
      const resDuplicateEmail = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Duplicate Tech Corp",
          phone: "9876500002",
          email: client1Email, // Same email as client1
          city: "Delhi",
        },
      });
      recordTest(
        "Section 2",
        "2.3 Duplicate client email triggers HTTP 409 CONFLICT",
        resDuplicateEmail.status === 409 && resDuplicateEmail.data?.error?.code === "CONFLICT",
        `Expected 409 CONFLICT, received: ${resDuplicateEmail.status}`,
        resDuplicateEmail.data
      );

      // 2.4 Admin creates client with optional fields omitted (empty email, no address/notes) -> 201
      const resMinimalClient = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Minimalist Event Co",
          phone: "9876500003",
          email: "",
        },
      });
      const minClient = resMinimalClient.data?.data;
      if (minClient?.id) {
        createdClientIds.add(minClient.id);
      }
      recordTest(
        "Section 2",
        "2.4 Admin creates client with optional fields omitted or empty email (HTTP 201 CREATED)",
        resMinimalClient.status === 201 && minClient?.email === null && minClient?.name === "Minimalist Event Co",
        `Expected 201, received: ${resMinimalClient.status}`,
        resMinimalClient.data
      );
    }

    // =========================================================================
    // SECTION 3: Client Creation with Login User Account
    // =========================================================================
    console.log("\n==> SECTION 3: Client Creation with Login User Account");
    let client2Id = "";
    const client2UserEmail = `client2-user-${Date.now()}@test.local`;
    const client2Password = "ClientSecret@2026";

    {
      // 3.1 Admin creates client with createUserAccount=true in a single transaction (201 Created)
      const resCreateWithAccount = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Apex Luxury Weddings",
          phone: "9876500004",
          email: client2UserEmail,
          city: "Bengaluru",
          createUserAccount: true,
          userEmail: client2UserEmail,
          userPassword: client2Password,
        },
      });

      const clientWithAccount = resCreateWithAccount.data?.data;
      if (clientWithAccount?.id) {
        client2Id = clientWithAccount.id;
        clientUserClientId = clientWithAccount.id;
        createdClientIds.add(client2Id);
      }
      if (clientWithAccount?.user?.id) {
        clientUserId = clientWithAccount.user.id;
        createdUserIds.add(clientUserId);
      }

      const clientCreatedOk =
        resCreateWithAccount.status === 201 &&
        clientWithAccount?.id &&
        clientWithAccount?.user?.id &&
        clientWithAccount?.user?.email === client2UserEmail.toLowerCase() &&
        clientWithAccount?.user?.role === "CLIENT" &&
        clientWithAccount?.user?.passwordHash === undefined; // Never leak hash in API

      recordTest(
        "Section 3",
        "3.1 Admin creates client with createUserAccount=true in a single transaction (HTTP 201 CREATED)",
        Boolean(clientCreatedOk),
        `Expected 201 with linked user, received: ${resCreateWithAccount.status}`,
        resCreateWithAccount.data
      );

      // 3.2 Verify linked User in database with role=CLIENT and clientId pointing to client
      const dbUser = await prisma.user.findUnique({
        where: { id: clientUserId },
      });
      recordTest(
        "Section 3",
        "3.2 Linked User in DB has role=CLIENT, isActive=true, and clientId pointing to new Client",
        dbUser !== null &&
          dbUser.role === USERROLE.CLIENT &&
          dbUser.isActive === true &&
          dbUser.clientId === client2Id,
        `dbUser: ${JSON.stringify(dbUser)}`
      );

      // 3.3 Verify linked User password is a valid salted bcrypt hash
      const isBcrypt = dbUser?.passwordHash.startsWith("$2a$") || dbUser?.passwordHash.startsWith("$2b$");
      recordTest(
        "Section 3",
        "3.3 Linked User password was hashed with bcrypt (never stored as plaintext)",
        Boolean(isBcrypt && dbUser?.passwordHash !== client2Password),
        `PasswordHash format invalid or matched plaintext`
      );

      // 3.4 Newly created Client user can successfully authenticate via POST /api/v1/auth/login
      const clientLoginRes = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: {
          email: client2UserEmail,
          password: client2Password,
        },
      });

      clientUserToken = clientLoginRes.data?.data?.accessToken ?? "";
      const loginSuccess =
        clientLoginRes.status === 200 &&
        clientLoginRes.data?.data?.user?.email === client2UserEmail.toLowerCase() &&
        clientLoginRes.data?.data?.user?.role === "CLIENT" &&
        clientLoginRes.data?.data?.user?.clientId === client2Id &&
        typeof clientUserToken === "string" &&
        clientUserToken.length > 20;

      recordTest(
        "Section 3",
        "3.4 Newly created Client user authenticates successfully via POST /api/v1/auth/login",
        Boolean(loginSuccess),
        `Login failed: status ${clientLoginRes.status}, data: ${JSON.stringify(clientLoginRes.data)}`
      );

      // 3.5 Duplicate user email returns 409 Conflict
      const resDupUserEmail = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Another Agency",
          phone: "9876500005",
          email: `unique-client-${Date.now()}@test.local`,
          createUserAccount: true,
          userEmail: client2UserEmail, // Duplicate user email!
          userPassword: "Password123!",
        },
      });
      recordTest(
        "Section 3",
        "3.5 Duplicate user email returns HTTP 409 CONFLICT",
        resDupUserEmail.status === 409 && resDupUserEmail.data?.error?.code === "CONFLICT",
        `Expected 409, received: ${resDupUserEmail.status}`,
        resDupUserEmail.data
      );

      // 3.6 Atomic rollback verification: Failed user creation leaves no dangling client
      const danglingClient = await prisma.client.findFirst({
        where: { name: "Another Agency" },
      });
      recordTest(
        "Section 3",
        "3.6 Atomic transaction rollback: No orphan client created when user account conflict occurs",
        danglingClient === null,
        `Found orphan client in DB: ${JSON.stringify(danglingClient)}`
      );

      // 3.7 Client user trying to create a client receives 403 Forbidden
      const resClientCreateForbidden = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: clientUserToken,
        body: {
          name: "Unauthorized Client Creation",
          phone: "9876500006",
        },
      });
      recordTest(
        "Section 3",
        "3.7 Client user (role=CLIENT) trying to create a client receives HTTP 403 FORBIDDEN",
        resClientCreateForbidden.status === 403 && resClientCreateForbidden.data?.error?.code === "FORBIDDEN",
        `Expected 403, received: ${resClientCreateForbidden.status}`,
        resClientCreateForbidden.data
      );

      // 3.8 Missing password when createUserAccount=true returns HTTP 400 Bad Request
      const resMissingPassword = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "No Password Client",
          phone: "9876500007",
          email: `nopass-${Date.now()}@test.local`,
          createUserAccount: true,
        },
      });
      recordTest(
        "Section 3",
        "3.8 Missing password when createUserAccount=true returns HTTP 400 BAD_REQUEST",
        resMissingPassword.status === 400 && resMissingPassword.data?.error?.code === "BAD_REQUEST",
        `Expected 400, received: ${resMissingPassword.status}`,
        resMissingPassword.data
      );

      // 3.9 Password < 6 characters when createUserAccount=true returns HTTP 422 VALIDATION_ERROR
      const resShortPassword = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Short Password Client",
          phone: "9876500008",
          email: `shortpass-${Date.now()}@test.local`,
          createUserAccount: true,
          userPassword: "123", // < 6 chars
        },
      });
      recordTest(
        "Section 3",
        "3.9 Password < 6 characters returns HTTP 422 VALIDATION_ERROR",
        resShortPassword.status === 422 && resShortPassword.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resShortPassword.status}`,
        resShortPassword.data
      );
    }

    // =========================================================================
    // SECTION 4: Client List API (GET /api/v1/clients)
    // =========================================================================
    console.log("\n==> SECTION 4: Client List API (GET /api/v1/clients)");
    {
      // 4.1 Unauthenticated request receives 401 Unauthorized
      const resUnauthList = await apiRequest("/api/v1/clients");
      recordTest(
        "Section 4",
        "4.1 Unauthenticated request to GET /api/v1/clients receives HTTP 401 UNAUTHORIZED",
        resUnauthList.status === 401 && resUnauthList.data?.success === false,
        `Expected 401, received: ${resUnauthList.status}`
      );

      // 4.2 Client user receives 403 Forbidden on listing all clients
      const resClientListForbidden = await apiRequest("/api/v1/clients", {
        token: clientUserToken,
      });
      recordTest(
        "Section 4",
        "4.2 Client user receives HTTP 403 FORBIDDEN on listing all clients",
        resClientListForbidden.status === 403 && resClientListForbidden.data?.error?.code === "FORBIDDEN",
        `Expected 403, received: ${resClientListForbidden.status}`,
        resClientListForbidden.data
      );

      // 4.3 Admin can list clients with pagination (200 OK)
      const resAdminList = await apiRequest("/api/v1/clients", {
        token: adminToken,
      });
      const listData = resAdminList.data;
      const isListOk =
        resAdminList.status === 200 &&
        listData?.success === true &&
        Array.isArray(listData?.data) &&
        listData?.meta &&
        typeof listData?.meta?.total === "number" &&
        listData?.meta?.page === 1 &&
        listData?.meta?.limit === 20;

      recordTest(
        "Section 4",
        "4.3 Admin can list clients with HTTP 200 OK and pagination metadata",
        Boolean(isListOk),
        `Expected 200 with clients array & meta, received: ${resAdminList.status}`,
        listData
      );

      // 4.4 Pagination limit parameter restricts returned array size
      const resLimit = await apiRequest("/api/v1/clients?page=1&limit=2", {
        token: adminToken,
      });
      const limitData = resLimit.data;
      const isLimitOk =
        resLimit.status === 200 &&
        Array.isArray(limitData?.data) &&
        limitData.data.length <= 2 &&
        limitData?.meta?.limit === 2 &&
        limitData?.meta?.page === 1;

      recordTest(
        "Section 4",
        "4.4 Pagination limit parameter restricts returned array size (limit=2)",
        Boolean(isLimitOk),
        `Expected <=2 items with meta.limit=2, received length: ${limitData?.data?.length}`
      );

      // 4.5 Pagination page parameter offsets results correctly
      const resPage1 = await apiRequest("/api/v1/clients?page=1&limit=1", { token: adminToken });
      const resPage2 = await apiRequest("/api/v1/clients?page=2&limit=1", { token: adminToken });
      const item1Id = resPage1.data?.data?.[0]?.id;
      const item2Id = resPage2.data?.data?.[0]?.id;
      const isPaginationDistinct = Boolean(item1Id && item2Id && item1Id !== item2Id);

      recordTest(
        "Section 4",
        "4.5 Pagination page offset works correctly (page 1 and page 2 return distinct clients)",
        isPaginationDistinct,
        `Page 1 ID: ${item1Id}, Page 2 ID: ${item2Id}`
      );

      // 4.6 Search by name filters clients (case-insensitive)
      const resSearchName = await apiRequest("/api/v1/clients?search=global", {
        token: adminToken,
      });
      const foundByName = resSearchName.data?.data?.some(
        (c: any) => c.id === client1Id && c.name.toLowerCase().includes("global")
      );
      recordTest(
        "Section 4",
        "4.6 Search by name filters clients accurately (case-insensitive)",
        resSearchName.status === 200 && Boolean(foundByName),
        `Could not find client ${client1Id} in search results: ${JSON.stringify(resSearchName.data?.data?.map((c: any) => c.name))}`
      );

      // 4.7 Search by phone filters clients
      const resSearchPhone = await apiRequest("/api/v1/clients?search=9876500001", {
        token: adminToken,
      });
      const foundByPhone = resSearchPhone.data?.data?.some((c: any) => c.id === client1Id);
      recordTest(
        "Section 4",
        "4.7 Search by phone filters clients accurately",
        resSearchPhone.status === 200 && Boolean(foundByPhone),
        `Could not find client by phone 9876500001`
      );

      // 4.8 Search by city filters clients
      const resSearchCity = await apiRequest("/api/v1/clients?search=gurugram", {
        token: adminToken,
      });
      const foundByCity = resSearchCity.data?.data?.some((c: any) => c.id === client1Id);
      recordTest(
        "Section 4",
        "4.8 Search by city filters clients accurately",
        resSearchCity.status === 200 && Boolean(foundByCity),
        `Could not find client by city Gurugram`
      );

      // 4.9 Search with unmatched term returns empty data array
      const resSearchEmpty = await apiRequest("/api/v1/clients?search=NonExistentEntity999ZXY", {
        token: adminToken,
      });
      const isEmptyOk =
        resSearchEmpty.status === 200 &&
        Array.isArray(resSearchEmpty.data?.data) &&
        resSearchEmpty.data.data.length === 0 &&
        resSearchEmpty.data.meta?.total === 0;
      recordTest(
        "Section 4",
        "4.9 Search with non-matching query returns empty array (total=0)",
        Boolean(isEmptyOk),
        `Received: ${JSON.stringify(resSearchEmpty.data)}`
      );
    }

    // =========================================================================
    // SECTION 5: Single Client Profile API (GET /api/v1/clients/:id)
    // =========================================================================
    console.log("\n==> SECTION 5: Single Client Profile API (GET /api/v1/clients/:id)");
    {
      // 5.1 Unauthenticated request receives 401 Unauthorized
      const resUnauthGet = await apiRequest(`/api/v1/clients/${client1Id}`);
      recordTest(
        "Section 5",
        "5.1 Unauthenticated request to GET /api/v1/clients/:id receives HTTP 401 UNAUTHORIZED",
        resUnauthGet.status === 401 && resUnauthGet.data?.success === false,
        `Expected 401, received: ${resUnauthGet.status}`
      );

      // 5.2 Admin can view any client by ID (200 OK) with full history relations
      const resAdminGetClient = await apiRequest(`/api/v1/clients/${client1Id}`, {
        token: adminToken,
      });
      const adminClientData = resAdminGetClient.data?.data;
      const isAdminGetOk =
        resAdminGetClient.status === 200 &&
        adminClientData?.id === client1Id &&
        Array.isArray(adminClientData?.event) &&
        Array.isArray(adminClientData?.invoice) &&
        Array.isArray(adminClientData?.payments) &&
        Array.isArray(adminClientData?.quotations) &&
        adminClientData?._count !== undefined;

      recordTest(
        "Section 5",
        "5.2 Admin can view any client by ID (HTTP 200 OK) with relations history included",
        Boolean(isAdminGetOk),
        `Expected 200 with full history, received: ${resAdminGetClient.status}`,
        resAdminGetClient.data
      );

      // 5.3 Admin querying non-existent client ID returns 404 Not Found
      const nonExistentUuid = "00000000-0000-0000-0000-000000000000";
      const resAdminNotFound = await apiRequest(`/api/v1/clients/${nonExistentUuid}`, {
        token: adminToken,
      });
      recordTest(
        "Section 5",
        "5.3 Admin querying non-existent client ID returns HTTP 404 NOT_FOUND",
        resAdminNotFound.status === 404 && resAdminNotFound.data?.error?.code === "NOT_FOUND",
        `Expected 404, received: ${resAdminNotFound.status}`,
        resAdminNotFound.data
      );

      // 5.4 Client user can view their OWN profile (id === req.user.clientId) (200 OK)
      const resClientOwnProfile = await apiRequest(`/api/v1/clients/${clientUserClientId}`, {
        token: clientUserToken,
      });
      const ownClientData = resClientOwnProfile.data?.data;
      const isOwnProfileOk =
        resClientOwnProfile.status === 200 &&
        ownClientData?.id === clientUserClientId &&
        ownClientData?.name === "Apex Luxury Weddings";

      recordTest(
        "Section 5",
        "5.4 Client user can view their OWN profile (id === req.user.clientId) (HTTP 200 OK)",
        Boolean(isOwnProfileOk),
        `Expected 200 with own profile, received: ${resClientOwnProfile.status}`,
        resClientOwnProfile.data
      );

      // 5.5 Client user is BLOCKED from viewing another client's profile with 403 Forbidden
      const resClientOtherForbidden = await apiRequest(`/api/v1/clients/${client1Id}`, {
        token: clientUserToken, // client2 trying to view client1
      });
      recordTest(
        "Section 5",
        "5.5 Client user is BLOCKED from viewing another client's profile with HTTP 403 FORBIDDEN (IDOR protection)",
        resClientOtherForbidden.status === 403 && resClientOtherForbidden.data?.error?.code === "FORBIDDEN",
        `Expected 403, received: ${resClientOtherForbidden.status}`,
        resClientOtherForbidden.data
      );

      // 5.6 Client user querying non-existent client ID receives 403 Forbidden (ownership check executes first)
      const resClientNonExistent = await apiRequest(`/api/v1/clients/${nonExistentUuid}`, {
        token: clientUserToken,
      });
      recordTest(
        "Section 5",
        "5.6 Client user querying non-matching ID receives HTTP 403 FORBIDDEN (no existence disclosure)",
        resClientNonExistent.status === 403 && resClientNonExistent.data?.error?.code === "FORBIDDEN",
        `Expected 403, received: ${resClientNonExistent.status}`,
        resClientNonExistent.data
      );
    }

    // =========================================================================
    // SECTION 6: Client Update API (PUT /api/v1/clients/:id)
    // =========================================================================
    console.log("\n==> SECTION 6: Client Update API (PUT /api/v1/clients/:id)");
    {
      // 6.1 Unauthenticated request receives 401 Unauthorized
      const resUnauthUpdate = await apiRequest(`/api/v1/clients/${client1Id}`, {
        method: "PUT",
        body: { phone: "9876599999" },
      });
      recordTest(
        "Section 6",
        "6.1 Unauthenticated request to PUT /api/v1/clients/:id receives HTTP 401 UNAUTHORIZED",
        resUnauthUpdate.status === 401 && resUnauthUpdate.data?.success === false,
        `Expected 401, received: ${resUnauthUpdate.status}`
      );

      // 6.2 Client user receives 403 Forbidden when attempting to update a client
      const resClientUpdateForbidden = await apiRequest(`/api/v1/clients/${clientUserClientId}`, {
        method: "PUT",
        token: clientUserToken,
        body: { city: "New City" },
      });
      recordTest(
        "Section 6",
        "6.2 Client user receives HTTP 403 FORBIDDEN on attempting client update",
        resClientUpdateForbidden.status === 403 && resClientUpdateForbidden.data?.error?.code === "FORBIDDEN",
        `Expected 403, received: ${resClientUpdateForbidden.status}`,
        resClientUpdateForbidden.data
      );

      // 6.3 Admin can update client fields (phone, city, notes, address, name) (200 OK)
      const resAdminUpdate = await apiRequest(`/api/v1/clients/${client1Id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          name: "Global Tech Solutions International",
          phone: "9876588888",
          city: "Noida",
          address: "Sector 62, Innovation Hub",
          notes: "Updated tier 1 enterprise account",
        },
      });

      const updatedClient = resAdminUpdate.data?.data;
      const isUpdateOk =
        resAdminUpdate.status === 200 &&
        updatedClient?.id === client1Id &&
        updatedClient?.name === "Global Tech Solutions International" &&
        updatedClient?.phone === "9876588888" &&
        updatedClient?.city === "Noida" &&
        updatedClient?.address === "Sector 62, Innovation Hub" &&
        updatedClient?.notes === "Updated tier 1 enterprise account";

      recordTest(
        "Section 6",
        "6.3 Admin can update client fields (name, phone, city, address, notes) with HTTP 200 OK",
        Boolean(isUpdateOk),
        `Expected 200 with updated fields, received: ${resAdminUpdate.status}`,
        resAdminUpdate.data
      );

      // 6.4 Database verification: values persisted in DB
      const dbClient1 = await prisma.client.findUnique({ where: { id: client1Id } });
      recordTest(
        "Section 6",
        "6.4 Database persistence: Client record verified updated in database",
        dbClient1 !== null &&
          dbClient1.name === "Global Tech Solutions International" &&
          dbClient1.phone === "9876588888" &&
          dbClient1.city === "Noida",
        `dbClient1: ${JSON.stringify(dbClient1)}`
      );

      // 6.5 Email conflict on update: Trying to update Client 1's email to Client 2's email returns 409
      const resUpdateEmailConflict = await apiRequest(`/api/v1/clients/${client1Id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          email: client2UserEmail, // already belongs to Client 2
        },
      });
      recordTest(
        "Section 6",
        "6.5 Email conflict on update returns HTTP 409 CONFLICT",
        resUpdateEmailConflict.status === 409 && resUpdateEmailConflict.data?.error?.code === "CONFLICT",
        `Expected 409, received: ${resUpdateEmailConflict.status}`,
        resUpdateEmailConflict.data
      );

      // 6.6 Self email update: Updating client while retaining their existing email succeeds (no false conflict)
      const resUpdateSelfEmail = await apiRequest(`/api/v1/clients/${client1Id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          email: client1Email, // Same email Client 1 already owns
          notes: "Notes updated with self email retained",
        },
      });
      recordTest(
        "Section 6",
        "6.6 Self email update succeeds without false positive conflict (HTTP 200 OK)",
        resUpdateSelfEmail.status === 200 && resUpdateSelfEmail.data?.data?.notes === "Notes updated with self email retained",
        `Expected 200, received: ${resUpdateSelfEmail.status}`,
        resUpdateSelfEmail.data
      );

      // 6.7 Updating non-existent client ID returns 404 Not Found
      const resUpdateNotFound = await apiRequest("/api/v1/clients/00000000-0000-0000-0000-000000000000", {
        method: "PUT",
        token: adminToken,
        body: { city: "Non-existent City" },
      });
      recordTest(
        "Section 6",
        "6.7 Updating non-existent client ID returns HTTP 404 NOT_FOUND",
        resUpdateNotFound.status === 404 && resUpdateNotFound.data?.error?.code === "NOT_FOUND",
        `Expected 404, received: ${resUpdateNotFound.status}`,
        resUpdateNotFound.data
      );

      // 6.8 Invalid phone format on update returns HTTP 422 VALIDATION_ERROR
      const resUpdateInvalidPhone = await apiRequest(`/api/v1/clients/${client1Id}`, {
        method: "PUT",
        token: adminToken,
        body: { phone: "12345" },
      });
      recordTest(
        "Section 6",
        "6.8 Invalid phone format on update returns HTTP 422 VALIDATION_ERROR",
        resUpdateInvalidPhone.status === 422 && resUpdateInvalidPhone.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resUpdateInvalidPhone.status}`,
        resUpdateInvalidPhone.data
      );
    }

    // =========================================================================
    // SECTION 7: Link User Account API (POST /api/v1/clients/:id/link-user)
    // =========================================================================
    console.log("\n==> SECTION 7: Link User Account API (POST /api/v1/clients/:id/link-user)");
    let standaloneClientId = "";
    let standaloneUserId = "";
    let standaloneClient2Id = "";
    let standaloneUser2Id = "";

    {
      // 7.1 Create an unlinked Client and an unlinked User (role=CLIENT, clientId=null)
      const resCreateStandaloneClient = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Standalone Client Corp",
          phone: "9876500010",
          email: `standalone-${Date.now()}@test.local`,
          city: "Pune",
        },
      });
      standaloneClientId = resCreateStandaloneClient.data?.data?.id;
      createdClientIds.add(standaloneClientId);

      // Create unlinked client user in DB
      const standaloneUserEmail = `unlinked-user-${Date.now()}@test.local`;
      const unlinkedUser = await prisma.user.create({
        data: {
          name: "Unlinked Client User",
          email: standaloneUserEmail,
          passwordHash: await hashPassword("UserPass@123"),
          role: USERROLE.CLIENT,
          isActive: true,
          clientId: null,
        },
      });
      standaloneUserId = unlinkedUser.id;
      createdUserIds.add(standaloneUserId);

      // 7.2 Unauthenticated request receives 401 Unauthorized
      const resUnauthLink = await apiRequest(`/api/v1/clients/${standaloneClientId}/link-user`, {
        method: "POST",
        body: { userId: standaloneUserId },
      });
      recordTest(
        "Section 7",
        "7.1 Unauthenticated request to link-user receives HTTP 401 UNAUTHORIZED",
        resUnauthLink.status === 401 && resUnauthLink.data?.success === false,
        `Expected 401, received: ${resUnauthLink.status}`
      );

      // 7.3 Client user receives 403 Forbidden when calling link-user
      const resClientLinkForbidden = await apiRequest(`/api/v1/clients/${standaloneClientId}/link-user`, {
        method: "POST",
        token: clientUserToken,
        body: { userId: standaloneUserId },
      });
      recordTest(
        "Section 7",
        "7.2 Client user receives HTTP 403 FORBIDDEN when calling link-user",
        resClientLinkForbidden.status === 403 && resClientLinkForbidden.data?.error?.code === "FORBIDDEN",
        `Expected 403, received: ${resClientLinkForbidden.status}`,
        resClientLinkForbidden.data
      );

      // 7.4 Admin can link unlinked Client user account to client profile (200 OK)
      const resLinkSuccess = await apiRequest(`/api/v1/clients/${standaloneClientId}/link-user`, {
        method: "POST",
        token: adminToken,
        body: { userId: standaloneUserId },
      });
      const linkedUserResult = resLinkSuccess.data?.data;
      const isLinkOk =
        resLinkSuccess.status === 200 &&
        resLinkSuccess.data?.success === true &&
        linkedUserResult?.id === standaloneUserId &&
        linkedUserResult?.clientId === standaloneClientId &&
        linkedUserResult?.role === "CLIENT";

      recordTest(
        "Section 7",
        "7.3 Admin can link an unlinked Client user account to a client profile (HTTP 200 OK)",
        Boolean(isLinkOk),
        `Expected 200, received: ${resLinkSuccess.status}`,
        resLinkSuccess.data
      );

      // 7.5 Database verification: User now has clientId pointing to client
      const dbLinkedUser = await prisma.user.findUnique({ where: { id: standaloneUserId } });
      recordTest(
        "Section 7",
        "7.4 Database persistence: User clientId field confirmed linked to target client in database",
        dbLinkedUser?.clientId === standaloneClientId,
        `Expected clientId ${standaloneClientId}, got: ${dbLinkedUser?.clientId}`
      );

      // 7.6 Create a second unlinked user and try to link to the already-linked client -> 409 Conflict
      const unlinkedUser2 = await prisma.user.create({
        data: {
          name: "Unlinked User 2",
          email: `unlinked2-${Date.now()}@test.local`,
          passwordHash: await hashPassword("UserPass@123"),
          role: USERROLE.CLIENT,
          isActive: true,
          clientId: null,
        },
      });
      standaloneUser2Id = unlinkedUser2.id;
      createdUserIds.add(standaloneUser2Id);

      const resLinkAlreadyLinkedClient = await apiRequest(`/api/v1/clients/${standaloneClientId}/link-user`, {
        method: "POST",
        token: adminToken,
        body: { userId: standaloneUser2Id }, // client already has standaloneUserId
      });
      recordTest(
        "Section 7",
        "7.5 Linking another user to an already-linked client returns HTTP 409 CONFLICT",
        resLinkAlreadyLinkedClient.status === 409 && resLinkAlreadyLinkedClient.data?.error?.code === "CONFLICT",
        `Expected 409, received: ${resLinkAlreadyLinkedClient.status}`,
        resLinkAlreadyLinkedClient.data
      );

      // 7.7 Create second unlinked client and try to link already-linked user to it -> 409 Conflict
      const resCreateClient2 = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Standalone Client 2",
          phone: "9876500011",
          email: `standalone2-${Date.now()}@test.local`,
          city: "Kolkata",
        },
      });
      standaloneClient2Id = resCreateClient2.data?.data?.id;
      createdClientIds.add(standaloneClient2Id);

      const resLinkAlreadyLinkedUser = await apiRequest(`/api/v1/clients/${standaloneClient2Id}/link-user`, {
        method: "POST",
        token: adminToken,
        body: { userId: standaloneUserId }, // already linked to standaloneClientId!
      });
      recordTest(
        "Section 7",
        "7.6 Linking an already-linked user to another client returns HTTP 409 CONFLICT",
        resLinkAlreadyLinkedUser.status === 409 && resLinkAlreadyLinkedUser.data?.error?.code === "CONFLICT",
        `Expected 409, received: ${resLinkAlreadyLinkedUser.status}`,
        resLinkAlreadyLinkedUser.data
      );

      // 7.8 Attempting to link an ADMIN user returns 400 Bad Request
      const resLinkAdminUser = await apiRequest(`/api/v1/clients/${standaloneClient2Id}/link-user`, {
        method: "POST",
        token: adminToken,
        body: { userId: adminUser.id },
      });
      recordTest(
        "Section 7",
        "7.7 Attempting to link an ADMIN user returns HTTP 400 BAD_REQUEST (role must be CLIENT)",
        resLinkAdminUser.status === 400 && resLinkAdminUser.data?.error?.code === "BAD_REQUEST",
        `Expected 400, received: ${resLinkAdminUser.status}`,
        resLinkAdminUser.data
      );

      // 7.9 Attempting to link non-existent client ID returns 404 Not Found
      const resLinkNonExistentClient = await apiRequest("/api/v1/clients/00000000-0000-0000-0000-000000000000/link-user", {
        method: "POST",
        token: adminToken,
        body: { userId: standaloneUser2Id },
      });
      recordTest(
        "Section 7",
        "7.8 Attempting to link to a non-existent client ID returns HTTP 404 NOT_FOUND",
        resLinkNonExistentClient.status === 404 && resLinkNonExistentClient.data?.error?.code === "NOT_FOUND",
        `Expected 404, received: ${resLinkNonExistentClient.status}`,
        resLinkNonExistentClient.data
      );

      // 7.10 Attempting to link non-existent user ID returns 404 Not Found
      const resLinkNonExistentUser = await apiRequest(`/api/v1/clients/${standaloneClient2Id}/link-user`, {
        method: "POST",
        token: adminToken,
        body: { userId: "00000000-0000-0000-0000-000000000000" },
      });
      recordTest(
        "Section 7",
        "7.9 Attempting to link non-existent user ID returns HTTP 404 NOT_FOUND",
        resLinkNonExistentUser.status === 404 && resLinkNonExistentUser.data?.error?.code === "NOT_FOUND",
        `Expected 404, received: ${resLinkNonExistentUser.status}`,
        resLinkNonExistentUser.data
      );

      // 7.11 Non-UUID userId format returns HTTP 422 VALIDATION_ERROR
      const resLinkInvalidUuid = await apiRequest(`/api/v1/clients/${standaloneClient2Id}/link-user`, {
        method: "POST",
        token: adminToken,
        body: { userId: "not-a-valid-uuid" },
      });
      recordTest(
        "Section 7",
        "7.10 Invalid userId format (non-UUID) returns HTTP 422 VALIDATION_ERROR",
        resLinkInvalidUuid.status === 422 && resLinkInvalidUuid.data?.error?.code === "VALIDATION_ERROR",
        `Expected 422, received: ${resLinkInvalidUuid.status}`,
        resLinkInvalidUuid.data
      );
    }

    // =========================================================================
    // SECTION 8: Client Deletion API (DELETE /api/v1/clients/:id)
    // =========================================================================
    console.log("\n==> SECTION 8: Client Deletion API (DELETE /api/v1/clients/:id)");
    {
      // 8.1 Unauthenticated request receives 401 Unauthorized
      const resUnauthDelete = await apiRequest(`/api/v1/clients/${client1Id}`, {
        method: "DELETE",
      });
      recordTest(
        "Section 8",
        "8.1 Unauthenticated request to DELETE /api/v1/clients/:id receives HTTP 401 UNAUTHORIZED",
        resUnauthDelete.status === 401 && resUnauthDelete.data?.success === false,
        `Expected 401, received: ${resUnauthDelete.status}`
      );

      // 8.2 Client user receives 403 Forbidden
      const resClientDeleteForbidden = await apiRequest(`/api/v1/clients/${clientUserClientId}`, {
        method: "DELETE",
        token: clientUserToken,
      });
      recordTest(
        "Section 8",
        "8.2 Client user receives HTTP 403 FORBIDDEN when attempting client deletion",
        resClientDeleteForbidden.status === 403 && resClientDeleteForbidden.data?.error?.code === "FORBIDDEN",
        `Expected 403, received: ${resClientDeleteForbidden.status}`,
        resClientDeleteForbidden.data
      );

      // 8.3 Client with linked Event: Deletion is blocked with 400 Bad Request
      const clientWithEventRes = await apiRequest("/api/v1/clients", {
        method: "POST",
        token: adminToken,
        body: {
          name: "Client With Event Corp",
          phone: "9876500020",
          email: `client-event-${Date.now()}@test.local`,
          city: "Chennai",
        },
      });
      const clientWithEventId = clientWithEventRes.data?.data?.id;
      createdClientIds.add(clientWithEventId);

      // Create linked event
      const testEvent = await prisma.event.create({
        data: {
          eventNumber: `EVT-TEST-${Date.now()}`,
          clientId: clientWithEventId,
          title: "Annual Gala 2026",
          eventType: "CORPORATE",
          eventDate: new Date(),
          createdById: adminUser.id,
        },
      });
      createdEventIds.add(testEvent.id);

      // Attempt deletion by Admin -> Must fail with 400 Bad Request
      const resDeleteEventBlocked = await apiRequest(`/api/v1/clients/${clientWithEventId}`, {
        method: "DELETE",
        token: adminToken,
      });
      recordTest(
        "Section 8",
        "8.3 Client with linked Event: Deletion is BLOCKED with HTTP 400 BAD_REQUEST (audit trail preservation)",
        resDeleteEventBlocked.status === 400 && resDeleteEventBlocked.data?.error?.code === "BAD_REQUEST",
        `Expected 400, received: ${resDeleteEventBlocked.status}`,
        resDeleteEventBlocked.data
      );

      // 8.4 Client with linked Invoice: Deletion is blocked with 400 Bad Request
      // First clean up testEvent so we can attach invoice
      await prisma.event.delete({ where: { id: testEvent.id } });
      createdEventIds.delete(testEvent.id);

      const testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-TEST-${Date.now()}`,
          clientId: clientWithEventId,
          title: "Consulting Advance Invoice",
          invoiceDate: new Date(),
          subtotal: 50000,
          totalAmount: 50000,
          createdById: adminUser.id,
        },
      });
      createdInvoiceIds.add(testInvoice.id);

      const resDeleteInvoiceBlocked = await apiRequest(`/api/v1/clients/${clientWithEventId}`, {
        method: "DELETE",
        token: adminToken,
      });
      recordTest(
        "Section 8",
        "8.4 Client with linked Invoice: Deletion is BLOCKED with HTTP 400 BAD_REQUEST",
        resDeleteInvoiceBlocked.status === 400 && resDeleteInvoiceBlocked.data?.error?.code === "BAD_REQUEST",
        `Expected 400, received: ${resDeleteInvoiceBlocked.status}`,
        resDeleteInvoiceBlocked.data
      );

      // Remove invoice to allow client deletion testing
      await prisma.invoice.delete({ where: { id: testInvoice.id } });
      createdInvoiceIds.delete(testInvoice.id);

      // 8.5 Admin can delete client without relations (200 OK)
      const resDeleteSuccess = await apiRequest(`/api/v1/clients/${clientWithEventId}`, {
        method: "DELETE",
        token: adminToken,
      });
      recordTest(
        "Section 8",
        "8.5 Admin can delete client without relations (HTTP 200 OK)",
        resDeleteSuccess.status === 200 && resDeleteSuccess.data?.success === true,
        `Expected 200, received: ${resDeleteSuccess.status}`,
        resDeleteSuccess.data
      );
      createdClientIds.delete(clientWithEventId);

      // 8.6 Database verification: Deleted client no longer exists in DB
      const dbCheckDeleted = await prisma.client.findUnique({ where: { id: clientWithEventId } });
      recordTest(
        "Section 8",
        "8.6 Database persistence: Deleted client confirmed removed from database",
        dbCheckDeleted === null,
        `Found client still present in DB: ${JSON.stringify(dbCheckDeleted)}`
      );

      // 8.7 Deleting client with linked User account atomically deletes both client and user login
      // Delete standaloneClientId which is linked to standaloneUserId
      const resDeleteWithUser = await apiRequest(`/api/v1/clients/${standaloneClientId}`, {
        method: "DELETE",
        token: adminToken,
      });
      recordTest(
        "Section 8",
        "8.7 Deleting client with linked User account atomically deletes both client and user login",
        resDeleteWithUser.status === 200 && resDeleteWithUser.data?.success === true,
        `Expected 200, received: ${resDeleteWithUser.status}`,
        resDeleteWithUser.data
      );
      createdClientIds.delete(standaloneClientId);
      createdUserIds.delete(standaloneUserId);

      // 8.8 Database verification: Linked user account was also deleted
      const dbCheckDeletedUser = await prisma.user.findUnique({ where: { id: standaloneUserId } });
      recordTest(
        "Section 8",
        "8.8 Database persistence: Linked user login account confirmed removed when client was deleted",
        dbCheckDeletedUser === null,
        `Found user still present in DB: ${JSON.stringify(dbCheckDeletedUser)}`
      );

      // 8.9 Deleting non-existent client ID returns 404 Not Found
      const resDeleteNotFound = await apiRequest("/api/v1/clients/00000000-0000-0000-0000-000000000000", {
        method: "DELETE",
        token: adminToken,
      });
      recordTest(
        "Section 8",
        "8.9 Deleting non-existent client ID returns HTTP 404 NOT_FOUND",
        resDeleteNotFound.status === 404 && resDeleteNotFound.data?.error?.code === "NOT_FOUND",
        `Expected 404, received: ${resDeleteNotFound.status}`,
        resDeleteNotFound.data
      );
    }

    // =========================================================================
    // SECTION 9: Teardown, Cleanup & Schema Integrity
    // =========================================================================
    console.log("\n==> SECTION 9: Teardown, Cleanup & Schema Integrity");
    {
      // 9.1 Teardown all remaining tracked entities
      console.log(`  [Teardown] Cleaning up ${createdEventIds.size} events, ${createdInvoiceIds.size} invoices, ${createdUserIds.size} users, ${createdClientIds.size} clients...`);

      if (createdInvoiceIds.size > 0) {
        await prisma.invoice.deleteMany({ where: { id: { in: Array.from(createdInvoiceIds) } } });
      }
      if (createdEventIds.size > 0) {
        await prisma.event.deleteMany({ where: { id: { in: Array.from(createdEventIds) } } });
      }
      if (createdUserIds.size > 0) {
        await prisma.refreshToken.deleteMany({ where: { userId: { in: Array.from(createdUserIds) } } });
        await prisma.user.deleteMany({ where: { id: { in: Array.from(createdUserIds) } } });
      }
      if (createdClientIds.size > 0) {
        // Also ensure linked users are deleted first if any
        await prisma.user.deleteMany({ where: { clientId: { in: Array.from(createdClientIds) } } });
        await prisma.client.deleteMany({ where: { id: { in: Array.from(createdClientIds) } } });
      }

      // Safety net: remove any test clients or users created with test pattern
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: { contains: "@test.local" } },
            { name: { contains: "Test" } },
          ],
          role: { not: USERROLE.ADMIN },
        },
      });
      await prisma.client.deleteMany({
        where: {
          OR: [
            { email: { contains: "@test.local" } },
            { name: { contains: "Test" } },
          ],
        },
      });

      // 9.2 Verify database has no orphaned test entities
      const remainingTestClients = await prisma.client.count({
        where: { email: { contains: "@test.local" } },
      });
      const remainingTestUsers = await prisma.user.count({
        where: { email: { contains: "@test.local" } },
      });

      recordTest(
        "Section 9",
        "9.1 All test clients, users, events, and invoices cleanly removed from database",
        remainingTestClients === 0 && remainingTestUsers === 0,
        `Remaining test clients: ${remainingTestClients}, users: ${remainingTestUsers}`
      );

      // 9.3 Verify admin account remains intact
      const dbAdminCheck = await prisma.user.findFirst({
        where: { email: "admin@ems.local", role: USERROLE.ADMIN },
      });
      recordTest(
        "Section 9",
        "9.2 System Administrator account (admin@ems.local) remains intact, active, and operational",
        dbAdminCheck !== null && dbAdminCheck.isActive === true,
        `Admin account missing or deactivated: ${JSON.stringify(dbAdminCheck)}`
      );

      // 9.4 Verify schema.prisma is completely untouched
      const finalSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
      recordTest(
        "Section 9",
        "9.3 CRITICAL ARCHITECTURAL RULE VERIFIED: backend/prisma/schema.prisma is 100% UNTOUCHED",
        finalSchemaHash === EXPECTED_SCHEMA_HASH,
        `schema.prisma hash mismatch! Expected ${EXPECTED_SCHEMA_HASH}, got: ${finalSchemaHash}`
      );
    }
  } catch (err: any) {
    console.error("\n\x1b[31m[Test Suite Error]:", err, "\x1b[0m");
    recordTest("Fatal", "Test suite execution completed without uncaught exception", false, err.message);
  } finally {
    // Teardown HTTP Server
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          console.log("\n[Test Server] Ephemeral HTTP Server stopped.");
          resolve();
        });
      });
    }

    // Disconnect Prisma
    await prisma.$disconnect();
    console.log("[Test Database] Prisma connection disconnected.");

    // Print Structured Summary
    console.log("\n================================================================================");
    const passedTests = results.filter((r) => r.passed);
    const failedTests = results.filter((r) => !r.passed);
    const totalTests = results.length;

    console.log(`                     TEST SUMMARY: ${passedTests.length}/${totalTests} PASSED (${failedTests.length} FAILED)`);
    console.log("================================================================================\n");

    if (failedTests.length > 0) {
      console.error("\x1b[31mFailed Tests:\x1b[0m");
      for (const t of failedTests) {
        console.error(` - [${t.section}] ${t.name}: ${t.error ?? "Assertion failed"}`);
      }
      process.exitCode = 1;
    } else {
      console.log("\x1b[32mALL PHASE 3 CLIENT MANAGEMENT MODULE TESTS PASSED PERFECTLY (100% SUCCESS)!\x1b[0m\n");
      process.exitCode = 0;
    }
  }
}

runTestSuite();
