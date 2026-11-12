import http from "node:http";
import { execSync } from "node:child_process";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { hashToken, generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../utils/cookies.js";
import { assertClientOwnership } from "../utils/ownership.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { USERROLE } from "../generated/prisma/enums.js";
import apiRoutes from "../routes/index.js";
import type { Request } from "express";

// Mount an admin-guarded test route on apiRoutes to verify requireAdmin end-to-end
apiRoutes.get("/admin-only-test", authenticate, requireAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin access granted",
    user: req.user,
  });
});

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
    console.error(`         Error: ${error}`);
  }
}

function parseSetCookie(response: Response): Record<string, { value: string; flags: string[] }> {
  const headers = typeof (response.headers as any).getSetCookie === "function"
    ? (response.headers as any).getSetCookie()
    : [response.headers.get("set-cookie") ?? ""].filter(Boolean);

  const cookies: Record<string, { value: string; flags: string[] }> = {};
  for (const header of headers) {
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

async function runTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS PHASE 2 AUTHENTICATION & ACCESS CONTROL TEST SUITE");
  console.log("================================================================================\n");

  let server: http.Server | null = null;
  let baseUrl = "";

  try {
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

    // =========================================================================
    // SECTION 1: Password Utilities (bcrypt hashing and comparison)
    // =========================================================================
    console.log("==> SECTION 1: Password Utilities");
    try {
      const plainPassword = "TestSecret@2026!";
      const hashedPassword = await hashPassword(plainPassword);

      // 1.1 Hash format check
      const isBcryptFormat = hashedPassword.startsWith("$2a$") || hashedPassword.startsWith("$2b$");
      const isDifferent = hashedPassword !== plainPassword;
      recordTest(
        "Section 1",
        "1.1 hashPassword generates valid salted bcrypt hash",
        isBcryptFormat && isDifferent,
        !isBcryptFormat ? "Hash does not match bcrypt signature" : undefined
      );

      // 1.2 Salt uniqueness check
      const secondHashed = await hashPassword(plainPassword);
      recordTest(
        "Section 1",
        "1.2 bcrypt salts ensure unique hashes for same password",
        hashedPassword !== secondHashed,
        hashedPassword === secondHashed ? "Identical hashes produced without unique salts" : undefined
      );

      // 1.3 Compare valid password
      const matchSuccess = await comparePassword(plainPassword, hashedPassword);
      recordTest(
        "Section 1",
        "1.3 comparePassword returns true for matching plaintext and hash",
        matchSuccess === true,
        "comparePassword returned false for correct password"
      );

      // 1.4 Compare invalid password
      const matchWrong = await comparePassword("WrongPassword123!", hashedPassword);
      recordTest(
        "Section 1",
        "1.4 comparePassword returns false for incorrect plaintext",
        matchWrong === false,
        "comparePassword returned true for incorrect password"
      );

      // 1.5 Compare empty / malformed
      const matchEmpty = await comparePassword("", hashedPassword);
      let errorHandled = false;
      try {
        const matchMalformed = await comparePassword(plainPassword, "invalid_hash_string");
        errorHandled = matchMalformed === false;
      } catch {
        errorHandled = true; // bcrypt throwing error on malformed hash is also safe
      }
      recordTest(
        "Section 1",
        "1.5 comparePassword safely handles empty string and malformed hash",
        matchEmpty === false && errorHandled
      );
    } catch (err: any) {
      recordTest("Section 1", "Section 1 execution", false, err.message);
    }

    // =========================================================================
    // SECTION 2: Seed Script Idempotency (seed:admin)
    // =========================================================================
    console.log("\n==> SECTION 2: Seed Script Idempotency");
    try {
      // 2.1 Verify admin exists in DB
      const existingAdmin = await prisma.user.findFirst({
        where: { role: USERROLE.ADMIN },
      });
      recordTest(
        "Section 2",
        "2.1 Initial Administrator account exists in database",
        existingAdmin !== null && existingAdmin.email === "admin@ems.local",
        !existingAdmin ? "No administrator found in DB" : undefined
      );

      // 2.2 Run seed script again and check output and exit code
      let seedOutput = "";
      let seedExitCode = 0;
      try {
        seedOutput = execSync('cmd.exe /c "npx tsx src/scripts/seedAdmin.ts"', {
          cwd: process.cwd(),
          encoding: "utf-8",
        });
      } catch (execErr: any) {
        seedExitCode = execErr.status ?? 1;
        seedOutput = execErr.stdout ?? execErr.message;
      }

      const containsAlreadyExists = seedOutput.includes("already exists") || seedOutput.includes("Administrator account already exists");
      recordTest(
        "Section 2",
        "2.2 seedAdmin.ts runs idempotently without error (exit code 0)",
        seedExitCode === 0 && containsAlreadyExists,
        `Exit code: ${seedExitCode}, Output: ${seedOutput.trim()}`
      );

      // 2.3 Verify only one admin exists with admin@ems.local
      const adminCount = await prisma.user.count({
        where: { email: "admin@ems.local" },
      });
      recordTest(
        "Section 2",
        "2.3 Database contains exactly 1 administrator (no duplicate records)",
        adminCount === 1,
        `Admin count was ${adminCount}, expected 1`
      );
    } catch (err: any) {
      recordTest("Section 2", "Section 2 execution", false, err.message);
    }

    // =========================================================================
    // SECTION 3: Login API (POST /api/v1/auth/login)
    // =========================================================================
    console.log("\n==> SECTION 3: Login API (POST /api/v1/auth/login)");
    let adminAccessToken = "";
    let adminRefreshToken = "";
    let adminCookies: Record<string, { value: string; flags: string[] }> = {};

    try {
      // 3.1 Valid Admin Login
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@ems.local",
          password: "Admin@123456",
        }),
      });

      const loginData = await loginRes.json();
      adminCookies = parseSetCookie(loginRes);
      adminAccessToken = loginData.data?.accessToken;
      adminRefreshToken = adminCookies[REFRESH_TOKEN_COOKIE]?.value ?? "";

      const hasUser = loginData.data?.user?.email === "admin@ems.local" && loginData.data?.user?.role === "ADMIN";
      const noPasswordLeak = loginData.data?.user?.passwordHash === undefined;
      const hasAccessToken = typeof adminAccessToken === "string" && adminAccessToken.length > 20;

      recordTest(
        "Section 3",
        "3.1 Valid admin login returns HTTP 200, user profile, and access token without password leak",
        loginRes.status === 200 && loginData.success === true && hasUser && noPasswordLeak && hasAccessToken,
        `Status: ${loginRes.status}, data: ${JSON.stringify(loginData)}`
      );

      // 3.2 Verify HttpOnly cookies set
      const hasAccessCookie = Boolean(adminCookies[ACCESS_TOKEN_COOKIE]?.value);
      const hasRefreshCookie = Boolean(adminCookies[REFRESH_TOKEN_COOKIE]?.value);
      const isHttpOnly =
        adminCookies[ACCESS_TOKEN_COOKIE]?.flags.some((f) => f.toLowerCase() === "httponly") &&
        adminCookies[REFRESH_TOKEN_COOKIE]?.flags.some((f) => f.toLowerCase() === "httponly");

      recordTest(
        "Section 3",
        "3.2 Login sets HttpOnly access_token and refresh_token cookies",
        Boolean(hasAccessCookie && hasRefreshCookie && isHttpOnly),
        `Cookies received: ${JSON.stringify(adminCookies)}`
      );

      // 3.3 Verify DB refresh token created
      const hashedRefreshToken = hashToken(adminRefreshToken);
      const dbRefreshToken = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashedRefreshToken },
      });
      recordTest(
        "Section 3",
        "3.3 Login persists SHA-256 hashed refresh token in database with revokedAt=null",
        dbRefreshToken !== null && dbRefreshToken.revokedAt === null,
        !dbRefreshToken ? "Hashed token not found in database" : "Token already revoked"
      );

      // 3.4 Invalid password rejection (401)
      const wrongPassRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@ems.local",
          password: "IncorrectPassword123!",
        }),
      });
      const wrongPassData = await wrongPassRes.json();
      recordTest(
        "Section 3",
        "3.4 Login rejects invalid password with HTTP 401 UNAUTHORIZED",
        wrongPassRes.status === 401 && wrongPassData.error?.code === "UNAUTHORIZED",
        `Status: ${wrongPassRes.status}, code: ${wrongPassData.error?.code}`
      );

      // 3.5 Non-existent email rejection (401)
      const ghostEmailRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "does_not_exist@ems.local",
          password: "Admin@123456",
        }),
      });
      const ghostEmailData = await ghostEmailRes.json();
      recordTest(
        "Section 3",
        "3.5 Login rejects non-existent email with HTTP 401 UNAUTHORIZED",
        ghostEmailRes.status === 401 && ghostEmailData.error?.code === "UNAUTHORIZED",
        `Status: ${ghostEmailRes.status}, code: ${ghostEmailData.error?.code}`
      );

      // 3.6 Validation failure on invalid email format (422)
      const invalidEmailRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-a-valid-email-address",
          password: "Admin@123456",
        }),
      });
      const invalidEmailData = await invalidEmailRes.json();
      recordTest(
        "Section 3",
        "3.6 Login validates request body and returns HTTP 422 VALIDATION_ERROR for malformed email",
        invalidEmailRes.status === 422 && invalidEmailData.error?.code === "VALIDATION_ERROR",
        `Status: ${invalidEmailRes.status}, code: ${invalidEmailData.error?.code}`
      );

      // 3.7 Validation failure on short password (422)
      const shortPassRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@ems.local",
          password: "123",
        }),
      });
      const shortPassData = await shortPassRes.json();
      recordTest(
        "Section 3",
        "3.7 Login validates password length and returns HTTP 422 for password < 6 characters",
        shortPassRes.status === 422 && shortPassData.error?.code === "VALIDATION_ERROR",
        `Status: ${shortPassRes.status}, code: ${shortPassData.error?.code}`
      );
    } catch (err: any) {
      recordTest("Section 3", "Section 3 execution", false, err.message);
    }

    // =========================================================================
    // SECTION 4: Protected Route (GET /api/v1/auth/me)
    // =========================================================================
    console.log("\n==> SECTION 4: Protected Route (GET /api/v1/auth/me)");
    try {
      // 4.1 Access with valid cookie
      const meCookieRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: {
          Cookie: `${ACCESS_TOKEN_COOKIE}=${adminAccessToken}`,
        },
      });
      const meCookieData = await meCookieRes.json();
      recordTest(
        "Section 4",
        "4.1 Protected route /me grants access via access_token cookie (HTTP 200)",
        meCookieRes.status === 200 && meCookieData.data?.user?.email === "admin@ems.local",
        `Status: ${meCookieRes.status}, data: ${JSON.stringify(meCookieData)}`
      );

      // 4.2 Access with valid Bearer token header
      const meBearerRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${adminAccessToken}`,
        },
      });
      const meBearerData = await meBearerRes.json();
      recordTest(
        "Section 4",
        "4.2 Protected route /me grants access via Authorization: Bearer header (HTTP 200)",
        meBearerRes.status === 200 && meBearerData.data?.user?.email === "admin@ems.local",
        `Status: ${meBearerRes.status}, data: ${JSON.stringify(meBearerData)}`
      );

      // 4.3 Access with no token
      const meNoTokenRes = await fetch(`${baseUrl}/api/v1/auth/me`);
      const meNoTokenData = await meNoTokenRes.json();
      recordTest(
        "Section 4",
        "4.3 Protected route /me rejects unauthenticated request with HTTP 401 UNAUTHORIZED",
        meNoTokenRes.status === 401 && meNoTokenData.error?.code === "UNAUTHORIZED",
        `Status: ${meNoTokenRes.status}, code: ${meNoTokenData.error?.code}`
      );

      // 4.4 Access with malformed token
      const meMalformedRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: {
          Authorization: "Bearer completely.invalid.jwt.token",
        },
      });
      const meMalformedData = await meMalformedRes.json();
      recordTest(
        "Section 4",
        "4.4 Protected route /me rejects malformed token with HTTP 401 UNAUTHORIZED",
        meMalformedRes.status === 401 && meMalformedData.error?.code === "UNAUTHORIZED",
        `Status: ${meMalformedRes.status}, code: ${meMalformedData.error?.code}`
      );
    } catch (err: any) {
      recordTest("Section 4", "Section 4 execution", false, err.message);
    }

    // =========================================================================
    // SECTION 5: Token Rotation & Refresh (POST /api/v1/auth/refresh)
    // =========================================================================
    console.log("\n==> SECTION 5: Token Rotation & Refresh (POST /api/v1/auth/refresh)");
    let rotatedRefreshToken = "";
    let rotatedAccessToken = "";

    try {
      // 5.1 Valid Refresh Token Rotation via Cookie
      const initialRefreshCookie = adminCookies[REFRESH_TOKEN_COOKIE]?.value;

      const refreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${REFRESH_TOKEN_COOKIE}=${initialRefreshCookie}`,
        },
        body: JSON.stringify({}),
      });

      const refreshData = await refreshRes.json();
      const newCookies = parseSetCookie(refreshRes);
      rotatedAccessToken = refreshData.data?.accessToken;
      rotatedRefreshToken = newCookies[REFRESH_TOKEN_COOKIE]?.value ?? "";

      recordTest(
        "Section 5",
        "5.1 POST /refresh with valid cookie returns HTTP 200 and issues new access token",
        refreshRes.status === 200 && typeof rotatedAccessToken === "string" && rotatedAccessToken.length > 20,
        `Status: ${refreshRes.status}, data: ${JSON.stringify(refreshData)}`
      );

      // 5.2 Verify Old Refresh Token Revoked in Database
      const oldHash = hashToken(initialRefreshCookie ?? "");
      const oldDbRecord = await prisma.refreshToken.findUnique({
        where: { tokenHash: oldHash },
      });
      const isOldRevoked = oldDbRecord !== null && oldDbRecord.revokedAt !== null;

      // 5.3 Verify New Refresh Token Persisted in Database
      const newHash = hashToken(rotatedRefreshToken);
      const newDbRecord = await prisma.refreshToken.findUnique({
        where: { tokenHash: newHash },
      });
      const isNewActive = newDbRecord !== null && newDbRecord.revokedAt === null;

      recordTest(
        "Section 5",
        "5.2 Refresh token rotation atomically revokes old token and persists new active token in DB",
        isOldRevoked && isNewActive,
        `Old revoked: ${isOldRevoked}, New active: ${isNewActive}`
      );

      // 5.4 Newly issued access token is valid for protected routes
      const verifyNewAccessRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${rotatedAccessToken}`,
        },
      });
      recordTest(
        "Section 5",
        "5.3 Newly minted rotated access token successfully accesses protected endpoint /me",
        verifyNewAccessRes.status === 200,
        `Status: ${verifyNewAccessRes.status}`
      );

      // 5.5 Valid Refresh Token via Body Fallback
      const bodyRefreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken: rotatedRefreshToken,
        }),
      });
      const bodyRefreshData = await bodyRefreshRes.json();
      const bodyRefreshCookies = parseSetCookie(bodyRefreshRes);
      const finalActiveRefreshToken = bodyRefreshCookies[REFRESH_TOKEN_COOKIE]?.value;

      recordTest(
        "Section 5",
        "5.4 POST /refresh accepts token via request body fallback when cookies are absent",
        bodyRefreshRes.status === 200 && bodyRefreshData.success === true,
        `Status: ${bodyRefreshRes.status}, data: ${JSON.stringify(bodyRefreshData)}`
      );

      // 5.6 Reuse Detection (Replay Attack): Resubmit previously rotated token!
      // Here initialRefreshCookie was already revoked. Submitting it must trigger breach detection.
      const reuseRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${REFRESH_TOKEN_COOKIE}=${initialRefreshCookie}`,
        },
        body: JSON.stringify({}),
      });
      const reuseData = await reuseRes.json();
      const isReuseRejected =
        reuseRes.status === 401 &&
        reuseData.error?.code === "UNAUTHORIZED" &&
        reuseData.error?.message?.includes("reuse detected");

      recordTest(
        "Section 5",
        "5.5 Token reuse detection: Replaying revoked token triggers HTTP 401 and security breach alert",
        isReuseRejected,
        `Status: ${reuseRes.status}, message: ${reuseData.error?.message}`
      );

      // 5.7 Verify that reuse detection revoked ALL user sessions
      const activeTokensCount = await prisma.refreshToken.count({
        where: {
          userId: oldDbRecord!.userId,
          revokedAt: null,
        },
      });
      recordTest(
        "Section 5",
        "5.6 Token reuse detection invalidates all active sessions for the user family in DB",
        activeTokensCount === 0,
        `Active tokens remaining: ${activeTokensCount}, expected 0`
      );

      // 5.8 Refresh with the previously active token now also fails
      const cascadeFailRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: finalActiveRefreshToken }),
      });
      recordTest(
        "Section 5",
        "5.7 Previously active sessions are confirmed invalidated following reuse detection",
        cascadeFailRes.status === 401,
        `Status: ${cascadeFailRes.status}`
      );
    } catch (err: any) {
      recordTest("Section 5", "Section 5 execution", false, err.message);
    }

    // =========================================================================
    // SECTION 6: Logout API (POST /api/v1/auth/logout)
    // =========================================================================
    console.log("\n==> SECTION 6: Logout API (POST /api/v1/auth/logout)");
    try {
      // 6.1 Login fresh session to test clean logout
      const freshLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@ems.local",
          password: "Admin@123456",
        }),
      });
      const freshCookies = parseSetCookie(freshLoginRes);
      const freshRefreshToken = freshCookies[REFRESH_TOKEN_COOKIE]?.value;

      // 6.2 Execute Logout
      const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: `${REFRESH_TOKEN_COOKIE}=${freshRefreshToken}`,
        },
      });
      const logoutData = await logoutRes.json();
      const logoutCookies = parseSetCookie(logoutRes);

      recordTest(
        "Section 6",
        "6.1 POST /logout returns HTTP 200 with success confirmation",
        logoutRes.status === 200 && logoutData.success === true,
        `Status: ${logoutRes.status}, data: ${JSON.stringify(logoutData)}`
      );

      // 6.3 Verify Cookies cleared
      // When clearing cookies, Express sends Max-Age=0 or Expires in past or empty value
      const accessCleared =
        !logoutCookies[ACCESS_TOKEN_COOKIE] ||
        logoutCookies[ACCESS_TOKEN_COOKIE].value === "" ||
        logoutCookies[ACCESS_TOKEN_COOKIE].flags.some((f) => f.includes("Max-Age=0") || f.includes("Expires=Thu, 01 Jan 1970"));
      const refreshCleared =
        !logoutCookies[REFRESH_TOKEN_COOKIE] ||
        logoutCookies[REFRESH_TOKEN_COOKIE].value === "" ||
        logoutCookies[REFRESH_TOKEN_COOKIE].flags.some((f) => f.includes("Max-Age=0") || f.includes("Expires=Thu, 01 Jan 1970"));

      recordTest(
        "Section 6",
        "6.2 Logout instructs client browser to clear authentication cookies via Set-Cookie",
        accessCleared && refreshCleared,
        `Logout cookies: ${JSON.stringify(logoutCookies)}`
      );

      // 6.4 Verify Token revoked in DB
      const logoutTokenHash = hashToken(freshRefreshToken ?? "");
      const dbLogoutToken = await prisma.refreshToken.findUnique({
        where: { tokenHash: logoutTokenHash },
      });
      recordTest(
        "Section 6",
        "6.3 Logout marks refresh token revokedAt timestamp in database",
        dbLogoutToken !== null && dbLogoutToken.revokedAt !== null,
        !dbLogoutToken ? "Token not found" : "revokedAt is null"
      );

      // 6.5 Refresh with logged-out token fails
      const postLogoutRefreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: freshRefreshToken }),
      });
      recordTest(
        "Section 6",
        "6.4 Subsequent session refresh using logged-out token is rejected with HTTP 401",
        postLogoutRefreshRes.status === 401,
        `Status: ${postLogoutRefreshRes.status}`
      );
    } catch (err: any) {
      recordTest("Section 6", "Section 6 execution", false, err.message);
    }

    // =========================================================================
    // SECTION 7: Role & Ownership Authorization Guards
    // =========================================================================
    console.log("\n==> SECTION 7: Role & Ownership Authorization Guards");
    let testClientId = "";
    let testUserId = "";

    try {
      // 7.1 Setup test dummy Client and User (role: CLIENT) in DB
      const testClient = await prisma.client.create({
        data: {
          name: "Acme Event Testing Corp",
          email: "acme.test@ems.local",
          phone: "+919999888877",
          city: "Metropolis",
          address: "42 Galaxy Way",
        },
      });
      testClientId = testClient.id;

      const clientPassword = "ClientSecret@123!";
      const clientPasswordHash = await hashPassword(clientPassword);

      const testUser = await prisma.user.create({
        data: {
          name: "Alice Client",
          email: "alice.test@ems.local",
          passwordHash: clientPasswordHash,
          role: USERROLE.CLIENT,
          isActive: true,
          clientId: testClientId,
        },
      });
      testUserId = testUser.id;

      recordTest(
        "Section 7",
        "7.1 Created test Client entity and linked User with role=CLIENT in database",
        Boolean(testClientId && testUserId)
      );

      // 7.2 Login as Client User
      const clientLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alice.test@ems.local",
          password: clientPassword,
        }),
      });
      const clientLoginData = await clientLoginRes.json();
      const clientAccessToken = clientLoginData.data?.accessToken;

      recordTest(
        "Section 7",
        "7.2 Client user logs in successfully and receives valid JWT token",
        clientLoginRes.status === 200 && typeof clientAccessToken === "string" && clientLoginData.data?.user?.role === "CLIENT",
        `Status: ${clientLoginRes.status}, data: ${JSON.stringify(clientLoginData)}`
      );

      // 7.3 Authenticate middleware accepts Client user
      const clientMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${clientAccessToken}`,
        },
      });
      const clientMeData = await clientMeRes.json();
      recordTest(
        "Section 7",
        "7.3 authenticate middleware successfully authenticates Client user on /me",
        clientMeRes.status === 200 && clientMeData.data?.user?.clientId === testClientId,
        `Status: ${clientMeRes.status}, data: ${JSON.stringify(clientMeData)}`
      );

      // 7.4 requireAdmin middleware blocks Client user with HTTP 403 Forbidden
      const clientAdminRouteRes = await fetch(`${baseUrl}/api/v1/admin-only-test`, {
        headers: {
          Authorization: `Bearer ${clientAccessToken}`,
        },
      });
      const clientAdminRouteData = await clientAdminRouteRes.json();
      recordTest(
        "Section 7",
        "7.4 requireAdmin middleware blocks Client user with HTTP 403 FORBIDDEN",
        clientAdminRouteRes.status === 403 &&
          clientAdminRouteData.error?.code === "FORBIDDEN" &&
          clientAdminRouteData.error?.message?.includes("Role 'CLIENT' is not authorized"),
        `Status: ${clientAdminRouteRes.status}, data: ${JSON.stringify(clientAdminRouteData)}`
      );

      // 7.5 requireAdmin middleware permits Admin user with HTTP 200 OK
      const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@ems.local",
          password: "Admin@123456",
        }),
      });
      const adminLoginData = await adminLoginRes.json();
      const freshAdminToken = adminLoginData.data?.accessToken;

      const adminAccessRes = await fetch(`${baseUrl}/api/v1/admin-only-test`, {
        headers: {
          Authorization: `Bearer ${freshAdminToken}`,
        },
      });
      const adminAccessData = await adminAccessRes.json();
      recordTest(
        "Section 7",
        "7.5 requireAdmin middleware permits Admin user with HTTP 200 OK",
        adminAccessRes.status === 200 && adminAccessData.success === true,
        `Status: ${adminAccessRes.status}, data: ${JSON.stringify(adminAccessData)}`
      );

      // 7.6 assertClientOwnership Guard Verification
      const mockAdminReq = {
        user: { id: "admin-id", email: "admin@ems.local", role: USERROLE.ADMIN, clientId: null, name: "Admin" },
      } as unknown as Request;

      const mockClientReq = {
        user: { id: testUserId, email: "alice.test@ems.local", role: USERROLE.CLIENT, clientId: testClientId, name: "Alice" },
      } as unknown as Request;

      const mockUnauthReq = {} as unknown as Request;

      // Test A: Admin accessing any client record
      let adminAllowedOwn = false;
      let adminAllowedForeign = false;
      try {
        assertClientOwnership(mockAdminReq, testClientId);
        adminAllowedOwn = true;
        assertClientOwnership(mockAdminReq, "some-other-foreign-client-id");
        adminAllowedForeign = true;
      } catch {}

      recordTest(
        "Section 7",
        "7.6 assertClientOwnership grants unrestricted access to ADMIN role",
        adminAllowedOwn && adminAllowedForeign,
        `adminAllowedOwn: ${adminAllowedOwn}, adminAllowedForeign: ${adminAllowedForeign}`
      );

      // Test B: Client accessing own client record
      let clientAllowedOwn = false;
      try {
        assertClientOwnership(mockClientReq, testClientId);
        clientAllowedOwn = true;
      } catch {}

      recordTest(
        "Section 7",
        "7.7 assertClientOwnership permits CLIENT accessing their own clientId",
        clientAllowedOwn,
        "Failed to allow client access to own record"
      );

      // Test C: Client accessing another client record -> MUST THROW 403
      let clientBlockedForeign = false;
      try {
        assertClientOwnership(mockClientReq, "foreign-unauthorized-client-id");
      } catch (err: any) {
        if (err.statusCode === 403 && err.errorCode === "FORBIDDEN") {
          clientBlockedForeign = true;
        }
      }

      recordTest(
        "Section 7",
        "7.8 assertClientOwnership throws ForbiddenError (403) when CLIENT accesses another clientId",
        clientBlockedForeign,
        "Did not throw 403 Forbidden on mismatched clientId"
      );

      // Test D: Unauthenticated request -> MUST THROW 401
      let unauthBlocked = false;
      try {
        assertClientOwnership(mockUnauthReq, testClientId);
      } catch (err: any) {
        if (err.statusCode === 401 && err.errorCode === "UNAUTHORIZED") {
          unauthBlocked = true;
        }
      }

      recordTest(
        "Section 7",
        "7.9 assertClientOwnership throws UnauthorizedError (401) when user is not authenticated",
        unauthBlocked,
        "Did not throw 401 Unauthorized for unauthenticated request"
      );
    } catch (err: any) {
      recordTest("Section 7", "Section 7 execution", false, err.message);
    } finally {
      // 7.10 Cleanup Test Client and User
      if (testUserId) {
        try {
          await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
          await prisma.user.delete({ where: { id: testUserId } });
          console.log("  [Cleanup] Removed test dummy User:", testUserId);
        } catch (e: any) {
          console.error("  [Cleanup] Error removing test dummy user:", e.message);
        }
      }
      if (testClientId) {
        try {
          await prisma.client.delete({ where: { id: testClientId } });
          console.log("  [Cleanup] Removed test dummy Client:", testClientId);
        } catch (e: any) {
          console.error("  [Cleanup] Error removing test dummy client:", e.message);
        }
      }

      // Verify records are gone
      const remainingUser = testUserId ? await prisma.user.findUnique({ where: { id: testUserId } }) : null;
      const remainingClient = testClientId ? await prisma.client.findUnique({ where: { id: testClientId } }) : null;
      recordTest(
        "Section 7",
        "7.10 Dummy test client and user records completely cleaned up from database",
        remainingUser === null && remainingClient === null,
        "Residual test data detected in database"
      );
    }

  } finally {
    // -------------------------------------------------------------------------
    // Shutdown Test Server & Disconnect Prisma
    // -------------------------------------------------------------------------
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

  console.log("================================================================================");
  console.log(`                     TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("================================================================================");

  if (failed > 0) {
    console.error(`\nFAILED TESTS (${failed}):`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(`- [${r.section}] ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log("\nALL PHASE 2 TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Unhandled test suite execution fatal error:", err);
  process.exit(1);
});
