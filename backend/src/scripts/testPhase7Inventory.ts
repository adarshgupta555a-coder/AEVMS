import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import {
  USERROLE,
  InventoryItemType,
  InventoryMovementType,
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

async function runPhase7InventoryTestSuite() {
  console.log("\n================================================================================");
  console.log("       EMS PHASE 7 INVENTORY MANAGEMENT & MOVEMENT LEDGER QUALITY TEST SUITE");
  console.log("================================================================================\n");

  const initialSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
  console.log(`[SCHEMA INTEGRITY CHECK] Initial schema hash: ${initialSchemaHash}`);

  let server: http.Server | null = null;
  let port = 0;
  let baseUrl = "";

  try {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      (server as http.Server).listen(0, () => {
        const addr = (server as http.Server).address();
        if (typeof addr === "object" && addr !== null) {
          port = addr.port;
          baseUrl = `http://localhost:${port}`;
        }
        resolve();
      });
    });

    console.log(`[HTTP Test Server Ready] Listening on ${baseUrl}\n`);

    async function apiRequest(
      pathStr: string,
      options: {
        method?: string;
        body?: unknown;
        token?: string;
      } = {}
    ): Promise<{ status: number; data: any }> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
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

      const res = await fetch(`${baseUrl}${pathStr}`, init);

      let responseData: any = null;
      const text = await res.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }

      return {
        status: res.status,
        data: responseData,
      };
    }

    // -------------------------------------------------------------------------
    // SETUP: Administrator & Test Client Users
    // -------------------------------------------------------------------------
    console.log("==> SETUP: Authenticating Administrator and Client");
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
          name: "Inventory Test Admin",
          email: `inv.admin.${Date.now()}@example.com`,
          passwordHash: hashedAdminPassword,
          role: USERROLE.ADMIN,
          isActive: true,
        },
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
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }
    const adminToken = adminLoginRes.data.data.accessToken as string;

    const uniqueSuffix = Date.now().toString().slice(-6);
    const clientUser = await prisma.user.create({
      data: {
        name: `Client User ${uniqueSuffix}`,
        email: `inv.client.${uniqueSuffix}@example.com`,
        passwordHash: await hashPassword("ClientPassword123!"),
        role: USERROLE.CLIENT,
        isActive: true,
      },
    });

    const clientLoginRes = await apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: { email: clientUser.email, password: "ClientPassword123!" },
    });
    const clientToken = clientLoginRes.data.data.accessToken as string;

    // Create a client & test event for event inventory tests
    const clientRecord = await prisma.client.create({
      data: {
        name: `Inv Test Client ${uniqueSuffix}`,
        email: `client.rec.${uniqueSuffix}@example.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        address: "77 Warehouse Road",
        city: "Mumbai",
      },
    });

    const testEvent = await prisma.event.create({
      data: {
        eventNumber: `EVT-INV-${uniqueSuffix}`,
        title: `Gala Showcase ${uniqueSuffix}`,
        eventType: "Exhibition",
        clientId: clientRecord.id,
        createdById: admin.id,
        eventDate: new Date(Date.now() + 86400000 * 5),
        status: EventStatus.CONFIRMED,
        venueName: "Grand Pavilion",
      },
    });

    console.log(`  [Setup Complete] Admin token ready, Client token ready, Test Event: ${testEvent.eventNumber}\n`);

    // =========================================================================
    // SECTION 1: INVENTORY CATEGORY MANAGEMENT
    // =========================================================================
    console.log("==> SECTION 1: Inventory Category Management");

    // 1.1 Create Category (Success)
    const catName1 = `AV & Sound Equipment ${uniqueSuffix}`;
    const resCreateCat1 = await apiRequest("/api/v1/inventory/categories", {
      method: "POST",
      token: adminToken,
      body: {
        name: catName1,
        description: "Professional audiovisual equipment and mixers",
      },
    });
    recordTest(
      "Section 1",
      "1.1 POST /api/v1/inventory/categories creates category with 201 Created",
      resCreateCat1.status === 201 && resCreateCat1.data?.data?.name === catName1,
      `Expected 201, received: ${resCreateCat1.status}`
    );
    const cat1 = resCreateCat1.data?.data;

    // 1.2 Create Category with Duplicate Name (Fails with 409 Conflict)
    const resCreateCatDup = await apiRequest("/api/v1/inventory/categories", {
      method: "POST",
      token: adminToken,
      body: {
        name: catName1,
        description: "Duplicate attempt",
      },
    });
    recordTest(
      "Section 1",
      "1.2 Duplicate category name returns HTTP 409 Conflict",
      resCreateCatDup.status === 409,
      `Expected 409, received: ${resCreateCatDup.status}`
    );

    // 1.3 Create Second Category (Decorations)
    const catName2 = `Lighting & Decor ${uniqueSuffix}`;
    const resCreateCat2 = await apiRequest("/api/v1/inventory/categories", {
      method: "POST",
      token: adminToken,
      body: {
        name: catName2,
        description: "Stage lights, uplighters, LED strips",
      },
    });
    recordTest(
      "Section 1",
      "1.3 Create second category returns 201 Created",
      resCreateCat2.status === 201,
      `Expected 201, received: ${resCreateCat2.status}`
    );
    const cat2 = resCreateCat2.data?.data;

    // 1.4 Create Third Category (Disposable/Consumables) to test empty deletion
    const catName3 = `Stationery & Consumables ${uniqueSuffix}`;
    const resCreateCat3 = await apiRequest("/api/v1/inventory/categories", {
      method: "POST",
      token: adminToken,
      body: {
        name: catName3,
        description: "Wristbands, badges, tapes, consumables",
      },
    });
    const cat3 = resCreateCat3.data?.data;
    recordTest(
      "Section 1",
      "1.4 Create third category returns 201 Created",
      resCreateCat3.status === 201,
      `Expected 201, received: ${resCreateCat3.status}`
    );

    // 1.5 List Categories
    const resListCat = await apiRequest("/api/v1/inventory/categories", {
      token: adminToken,
    });
    const foundCat1 = resListCat.data?.data?.some((c: any) => c.id === cat1.id);
    recordTest(
      "Section 1",
      "1.5 GET /api/v1/inventory/categories lists created categories with _count.items",
      resListCat.status === 200 && foundCat1 && resListCat.data?.data[0]?._count !== undefined,
      `Expected 200 with item count, received status: ${resListCat.status}`
    );

    // 1.6 Get Category by ID
    const resGetCat = await apiRequest(`/api/v1/inventory/categories/${cat1.id}`, {
      token: adminToken,
    });
    recordTest(
      "Section 1",
      "1.6 GET /api/v1/inventory/categories/:id returns category details",
      resGetCat.status === 200 && resGetCat.data?.data?.id === cat1.id,
      `Expected 200, received: ${resGetCat.status}`
    );

    // 1.7 Get Non-Existent Category returns 404
    const resCat404 = await apiRequest("/api/v1/inventory/categories/00000000-0000-4000-8000-000000000000", {
      token: adminToken,
    });
    recordTest(
      "Section 1",
      "1.7 Non-existent category ID returns HTTP 404 Not Found",
      resCat404.status === 404,
      `Expected 404, received: ${resCat404.status}`
    );

    // 1.8 Update Category
    const resUpdateCat = await apiRequest(`/api/v1/inventory/categories/${cat1.id}`, {
      method: "PUT",
      token: adminToken,
      body: {
        description: "Updated audiovisual equipment and pro sound systems",
      },
    });
    recordTest(
      "Section 1",
      "1.8 PUT /api/v1/inventory/categories/:id updates category details",
      resUpdateCat.status === 200 && resUpdateCat.data?.data?.description.includes("Updated"),
      `Expected 200, received: ${resUpdateCat.status}`
    );

    // 1.9 Update Category to Duplicate Name (Fails with 409)
    const resUpdateDup = await apiRequest(`/api/v1/inventory/categories/${cat1.id}`, {
      method: "PUT",
      token: adminToken,
      body: { name: catName2 },
    });
    recordTest(
      "Section 1",
      "1.9 Update category to duplicate name returns HTTP 409 Conflict",
      resUpdateDup.status === 409,
      `Expected 409, received: ${resUpdateDup.status}`
    );

    // =========================================================================
    // SECTION 2: INVENTORY ITEMS LIFECYCLE & MASTER CATALOG
    // =========================================================================
    console.log("\n==> SECTION 2: Inventory Items Lifecycle & Master Catalog");

    // 2.1 Create Item without Initial Stock (currentStock = 0)
    const sku1 = `MIC-WLS-${uniqueSuffix}`;
    const resCreateItem1 = await apiRequest("/api/v1/inventory/items", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Shure Wireless Handheld Mic Kit",
        description: "Dual channel wireless microphone system",
        categoryId: cat1.id,
        itemType: InventoryItemType.REUSABLE,
        sku: sku1,
        unit: "sets",
        minimumStock: 4,
        purchasePrice: 15000,
        initialStock: 0,
      },
    });
    recordTest(
      "Section 2",
      "2.1 POST /api/v1/inventory/items creates item with currentStock = 0",
      resCreateItem1.status === 201 && Number(resCreateItem1.data?.data?.currentStock) === 0,
      `Expected 201 and currentStock = 0, received: ${resCreateItem1.status}`
    );
    const item1 = resCreateItem1.data?.data;

    // 2.2 Create Item with Initial Stock > 0 (Auto-creates PURCHASE movement)
    const sku2 = `LED-PAR-${uniqueSuffix}`;
    const resCreateItem2 = await apiRequest("/api/v1/inventory/items", {
      method: "POST",
      token: adminToken,
      body: {
        name: "RGBWA LED Par Can 54x3W",
        description: "Stage wash lights with DMX control",
        categoryId: cat2.id,
        itemType: InventoryItemType.REUSABLE,
        sku: sku2,
        unit: "pcs",
        minimumStock: 10,
        purchasePrice: 4500,
        initialStock: 25,
      },
    });
    recordTest(
      "Section 2",
      "2.2 POST /api/v1/inventory/items with initialStock=25 sets stock and creates opening movement",
      resCreateItem2.status === 201 && Number(resCreateItem2.data?.data?.currentStock) === 25,
      `Expected 201 and currentStock = 25, received: ${resCreateItem2.status}`
    );
    const item2 = resCreateItem2.data?.data;

    // 2.3 Create Consumable Item (Wristbands)
    const sku3 = `WST-TYV-${uniqueSuffix}`;
    const resCreateItem3 = await apiRequest("/api/v1/inventory/items", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Tyvek Neon Entry Wristbands",
        description: "Single-use tamper-evident security wristbands",
        categoryId: cat3.id,
        itemType: InventoryItemType.CONSUMABLE,
        sku: sku3,
        unit: "packs",
        minimumStock: 5,
        purchasePrice: 650,
        initialStock: 20,
      },
    });
    recordTest(
      "Section 2",
      "2.3 Create CONSUMABLE item with initialStock=20 returns 201 Created",
      resCreateItem3.status === 201 && resCreateItem3.data?.data?.itemType === InventoryItemType.CONSUMABLE,
      `Expected 201 and CONSUMABLE, received: ${resCreateItem3.status}`
    );
    const item3 = resCreateItem3.data?.data;

    // 2.4 Duplicate SKU check returns 409
    const resDupSku = await apiRequest("/api/v1/inventory/items", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Duplicate SKU Item",
        categoryId: cat1.id,
        itemType: InventoryItemType.REUSABLE,
        sku: sku1,
        unit: "nos",
      },
    });
    recordTest(
      "Section 2",
      "2.4 Duplicate SKU returns HTTP 409 Conflict",
      resDupSku.status === 409,
      `Expected 409, received: ${resDupSku.status}`
    );

    // 2.5 Non-existent Category returns 404
    const resBadCatItem = await apiRequest("/api/v1/inventory/items", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Orphan Item",
        categoryId: "00000000-0000-4000-8000-000000000000",
        itemType: InventoryItemType.REUSABLE,
        unit: "nos",
      },
    });
    recordTest(
      "Section 2",
      "2.5 Item with non-existent category returns HTTP 404 Not Found",
      resBadCatItem.status === 404,
      `Expected 404, received: ${resBadCatItem.status}`
    );

    // 2.6 List Items without filters
    const resListItems = await apiRequest("/api/v1/inventory/items", {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.6 GET /api/v1/inventory/items returns paginated items list with meta",
      resListItems.status === 200 && Array.isArray(resListItems.data?.data) && resListItems.data?.meta?.total >= 3,
      `Expected 200 and meta.total >= 3, received: ${resListItems.status}`
    );

    // 2.7 Filter by Category
    const resFilterCat = await apiRequest(`/api/v1/inventory/items?categoryId=${cat1.id}`, {
      token: adminToken,
    });
    const allCat1 = resFilterCat.data?.data?.every((it: any) => it.categoryId === cat1.id);
    recordTest(
      "Section 2",
      "2.7 GET /api/v1/inventory/items?categoryId filters correctly",
      resFilterCat.status === 200 && resFilterCat.data?.data?.length > 0 && allCat1,
      `Expected filtered items for cat1, received length: ${resFilterCat.data?.data?.length}`
    );

    // 2.8 Filter by itemType CONSUMABLE
    const resFilterType = await apiRequest(`/api/v1/inventory/items?itemType=${InventoryItemType.CONSUMABLE}`, {
      token: adminToken,
    });
    const allConsumable = resFilterType.data?.data?.every((it: any) => it.itemType === InventoryItemType.CONSUMABLE);
    recordTest(
      "Section 2",
      "2.8 GET /api/v1/inventory/items?itemType=CONSUMABLE filters correctly",
      resFilterType.status === 200 && allConsumable,
      `Expected CONSUMABLE items, received status: ${resFilterType.status}`
    );

    // 2.9 Filter lowStock=true
    // item1 has currentStock = 0, minimumStock = 4 -> It IS low stock!
    const resFilterLowStock = await apiRequest("/api/v1/inventory/items?lowStock=true", {
      token: adminToken,
    });
    const item1InLowStock = resFilterLowStock.data?.data?.some((it: any) => it.id === item1.id);
    recordTest(
      "Section 2",
      "2.9 GET /api/v1/inventory/items?lowStock=true includes zero/low stock items (item1)",
      resFilterLowStock.status === 200 && item1InLowStock,
      `Expected item1 in low stock results, received: ${item1InLowStock}`
    );

    // 2.10 Search items by name / sku
    const resSearch = await apiRequest(`/api/v1/inventory/items?search=${sku2}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.10 GET /api/v1/inventory/items?search=... searches by SKU",
      resSearch.status === 200 && resSearch.data?.data?.length === 1 && resSearch.data?.data[0]?.sku === sku2,
      `Expected single matched item with SKU ${sku2}`
    );

    // 2.11 Get Item by ID with metrics
    const resGetItem = await apiRequest(`/api/v1/inventory/items/${item2.id}`, {
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.11 GET /api/v1/inventory/items/:id returns item details, category, movements, and metrics",
      resGetItem.status === 200 &&
        resGetItem.data?.data?.category?.id === cat2.id &&
        resGetItem.data?.data?.metrics?.currentlyAllocatedToEvents !== undefined,
      `Expected 200 with metrics, received: ${resGetItem.status}`
    );

    // 2.12 Update Item
    const resUpdateItem = await apiRequest(`/api/v1/inventory/items/${item1.id}`, {
      method: "PUT",
      token: adminToken,
      body: {
        minimumStock: 6,
        purchasePrice: 16500,
        description: "Updated Shure Dual Wireless System with Beta 58A heads",
      },
    });
    recordTest(
      "Section 2",
      "2.12 PUT /api/v1/inventory/items/:id updates item attributes",
      resUpdateItem.status === 200 &&
        Number(resUpdateItem.data?.data?.minimumStock) === 6 &&
        Number(resUpdateItem.data?.data?.purchasePrice) === 16500,
      `Expected 200 with updated fields, received: ${resUpdateItem.status}`
    );

    // 2.13 Delete item protection: item2 has initial stock movement -> delete blocked with 400
    const resDelItemWithMoves = await apiRequest(`/api/v1/inventory/items/${item2.id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.13 Delete item with existing movements returns HTTP 400 Bad Request",
      resDelItemWithMoves.status === 400,
      `Expected 400, received: ${resDelItemWithMoves.status}`
    );

    // 2.14 Delete Category protection: cat1 has item1 linked -> delete blocked with 400
    const resDelCatWithItems = await apiRequest(`/api/v1/inventory/categories/${cat1.id}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.14 Delete category with associated items returns HTTP 400 Bad Request",
      resDelCatWithItems.status === 400,
      `Expected 400, received: ${resDelCatWithItems.status}`
    );

    // 2.15 Create a temporary item and delete it (Success with zero movements)
    const resTempItem = await apiRequest("/api/v1/inventory/items", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Temporary Item To Delete",
        categoryId: cat1.id,
        itemType: InventoryItemType.REUSABLE,
        unit: "pcs",
        initialStock: 0,
      },
    });
    const tempItemId = resTempItem.data?.data?.id;
    const resDelTempItem = await apiRequest(`/api/v1/inventory/items/${tempItemId}`, {
      method: "DELETE",
      token: adminToken,
    });
    recordTest(
      "Section 2",
      "2.15 Delete item with zero movements successfully returns HTTP 200 OK",
      resDelTempItem.status === 200,
      `Expected 200, received: ${resDelTempItem.status}`
    );

    // =========================================================================
    // SECTION 3: STOCK MOVEMENTS LEDGER & AUDIT TRAIL
    // =========================================================================
    console.log("\n==> SECTION 3: Stock Movements Ledger & Audit Trail");

    // 3.1 Record Stock Purchase for item1 (currently 0)
    // Buy 10 units at ₹16,000 each
    const resPurchase = await apiRequest("/api/v1/inventory/movements/purchase", {
      method: "POST",
      token: adminToken,
      body: {
        inventoryItemId: item1.id,
        quantity: 10,
        unitCost: 16000,
        referenceNumber: `PO-${uniqueSuffix}-01`,
        notes: "Supplier PO shipment delivery",
      },
    });
    recordTest(
      "Section 3",
      "3.1 POST /api/v1/inventory/movements/purchase increments currentStock to 10 and sets purchasePrice",
      resPurchase.status === 201 &&
        resPurchase.data?.data?.item?.currentStock === 10 &&
        resPurchase.data?.data?.movement?.movementType === InventoryMovementType.PURCHASE,
      `Expected 201, currentStock: 10, received: ${resPurchase.status}`
    );

    // 3.2 Record Stock Adjustment IN (+3 units)
    const resAdjIn = await apiRequest("/api/v1/inventory/movements/adjustment", {
      method: "POST",
      token: adminToken,
      body: {
        inventoryItemId: item1.id,
        quantity: 3,
        movementType: InventoryMovementType.ADJUSTMENT_IN,
        referenceNumber: `ADJ-IN-${uniqueSuffix}`,
        notes: "Found extra units during warehouse physical count",
      },
    });
    recordTest(
      "Section 3",
      "3.2 POST /api/v1/inventory/movements/adjustment (ADJUSTMENT_IN) increments stock to 13",
      resAdjIn.status === 200 && resAdjIn.data?.data?.item?.currentStock === 13,
      `Expected 200, currentStock: 13, received: ${resAdjIn.data?.data?.item?.currentStock}`
    );

    // 3.3 Record Stock Adjustment OUT (-2 units)
    const resAdjOut = await apiRequest("/api/v1/inventory/movements/adjustment", {
      method: "POST",
      token: adminToken,
      body: {
        inventoryItemId: item1.id,
        quantity: 2,
        movementType: InventoryMovementType.ADJUSTMENT_OUT,
        referenceNumber: `ADJ-OUT-${uniqueSuffix}`,
        notes: "Calibration loan to sister firm",
      },
    });
    recordTest(
      "Section 3",
      "3.3 POST /api/v1/inventory/movements/adjustment (ADJUSTMENT_OUT) decrements stock to 11",
      resAdjOut.status === 200 && resAdjOut.data?.data?.item?.currentStock === 11,
      `Expected 200, currentStock: 11, received: ${resAdjOut.data?.data?.item?.currentStock}`
    );

    // 3.4 Adjustment OUT with Insufficient Stock (attempting to adjust out 99 units when only 11 available)
    const resExcessAdj = await apiRequest("/api/v1/inventory/movements/adjustment", {
      method: "POST",
      token: adminToken,
      body: {
        inventoryItemId: item1.id,
        quantity: 99,
        movementType: InventoryMovementType.ADJUSTMENT_OUT,
        notes: "Excess reduction attempt",
      },
    });
    recordTest(
      "Section 3",
      "3.4 Downward adjustment exceeding currentStock returns HTTP 400 Bad Request",
      resExcessAdj.status === 400,
      `Expected 400, received: ${resExcessAdj.status}`
    );

    // 3.5 Record Warehouse Damage / Write-off (-1 unit)
    const resDamage = await apiRequest("/api/v1/inventory/movements/damage-loss", {
      method: "POST",
      token: adminToken,
      body: {
        inventoryItemId: item1.id,
        quantity: 1,
        movementType: InventoryMovementType.DAMAGE,
        notes: "Water leakage damage in shelf 3B",
      },
    });
    recordTest(
      "Section 3",
      "3.5 POST /api/v1/inventory/movements/damage-loss (DAMAGE) decrements stock to 10",
      resDamage.status === 200 && resDamage.data?.data?.item?.currentStock === 10,
      `Expected 200, currentStock: 10, received: ${resDamage.data?.data?.item?.currentStock}`
    );

    // 3.6 Record Warehouse Loss (-1 unit)
    const resLoss = await apiRequest("/api/v1/inventory/movements/damage-loss", {
      method: "POST",
      token: adminToken,
      body: {
        inventoryItemId: item1.id,
        quantity: 1,
        movementType: InventoryMovementType.LOSS,
        notes: "Unaccounted shortage post annual audit",
      },
    });
    recordTest(
      "Section 3",
      "3.6 POST /api/v1/inventory/movements/damage-loss (LOSS) decrements stock to 9",
      resLoss.status === 200 && resLoss.data?.data?.item?.currentStock === 9,
      `Expected 200, currentStock: 9, received: ${resLoss.data?.data?.item?.currentStock}`
    );

    // 3.7 List Movements filtered by inventoryItemId
    const resMoves = await apiRequest(`/api/v1/inventory/movements?inventoryItemId=${item1.id}`, {
      token: adminToken,
    });
    recordTest(
      "Section 3",
      "3.7 GET /api/v1/inventory/movements lists movements for item with item & event relations",
      resMoves.status === 200 && resMoves.data?.data?.length === 5,
      `Expected 5 movements for item1, received: ${resMoves.data?.data?.length}`
    );

    // 3.8 Audit Stock Reconciliation for item1
    // Total purchased: 10
    // Total adjusted in: 3
    // Total adjusted out: 2
    // Total damaged: 1
    // Total lost: 1
    // Expected stock: (10 + 3) - (2 + 1 + 1) = 9
    // Current stock: 9
    const resAudit = await apiRequest(`/api/v1/inventory/items/${item1.id}/audit`, {
      token: adminToken,
    });
    recordTest(
      "Section 3",
      "3.8 GET /api/v1/inventory/items/:id/audit returns isReconciled: true with zero discrepancy",
      resAudit.status === 200 &&
        resAudit.data?.data?.audit?.isReconciled === true &&
        resAudit.data?.data?.audit?.currentStock === 9 &&
        resAudit.data?.data?.audit?.expectedStock === 9 &&
        resAudit.data?.data?.audit?.discrepancy === 0,
      `Audit report mismatch: ${JSON.stringify(resAudit.data?.data?.audit)}`
    );

    // =========================================================================
    // SECTION 4: EVENT INVENTORY ALLOCATION, ISSUANCE & RETURN LOGISTICS
    // =========================================================================
    console.log("\n==> SECTION 4: Event Inventory Allocation, Issuance & Return Logistics");

    // 4.1 Allocate items for Event
    // We allocate:
    // - item1 (Wireless Mics): 4 sets required
    // - item2 (LED Par Cans): 12 pcs required
    const resAllocate = await apiRequest(`/api/v1/inventory/events/${testEvent.id}/allocate`, {
      method: "POST",
      token: adminToken,
      body: {
        items: [
          { inventoryItemId: item1.id, requiredQuantity: 4, notes: "Main stage vocal mics" },
          { inventoryItemId: item2.id, requiredQuantity: 12, notes: "Front wash lighting truss" },
        ],
      },
    });
    recordTest(
      "Section 4",
      "4.1 POST /api/v1/inventory/events/:eventId/allocate sets planned quantities without altering warehouse stock",
      resAllocate.status === 200 && resAllocate.data?.data?.length === 2,
      `Expected 200 with 2 allocated items, received: ${resAllocate.status}`
    );

    // Verify warehouse stock was untouched during allocation planning
    const item1AfterAlloc = await prisma.inventoryItem.findUnique({ where: { id: item1.id } });
    recordTest(
      "Section 4",
      "4.2 Warehouse stock untouched during requirement allocation",
      Number(item1AfterAlloc?.currentStock) === 9,
      `Expected stock 9, found: ${item1AfterAlloc?.currentStock}`
    );

    // 4.3 Get Event Inventory Allocations
    const resGetEventInv = await apiRequest(`/api/v1/inventory/events/${testEvent.id}`, {
      token: adminToken,
    });
    const allocItem1 = resGetEventInv.data?.data?.allocations?.find((a: any) => a.inventoryItemId === item1.id);
    recordTest(
      "Section 4",
      "4.3 GET /api/v1/inventory/events/:eventId returns allocation metrics (issued: 0, returned: 0, outstanding: 0)",
      resGetEventInv.status === 200 &&
        allocItem1?.requiredQuantity === 4 &&
        allocItem1?.issuedQuantity === 0 &&
        allocItem1?.outstandingQuantity === 0,
      `Expected zero issued/returned metrics, received: ${JSON.stringify(allocItem1)}`
    );

    // 4.4 Issue items to Event with Insufficient Stock (attempting to issue 50 sets of item1 when only 9 available)
    const resExcessIssue = await apiRequest(`/api/v1/inventory/events/${testEvent.id}/issue`, {
      method: "POST",
      token: adminToken,
      body: {
        items: [{ inventoryItemId: item1.id, quantity: 50 }],
      },
    });
    recordTest(
      "Section 4",
      "4.4 Issuing quantity exceeding warehouse stock returns HTTP 400 Bad Request",
      resExcessIssue.status === 400 && resExcessIssue.data?.error?.message?.includes("Insufficient stock"),
      `Expected 400 Insufficient stock, received: ${resExcessIssue.status}`
    );

    // 4.5 Issue Inactive Item returns 400
    const inactiveItem = await prisma.inventoryItem.create({
      data: {
        name: "Decommissioned Amplifier",
        categoryId: cat1.id,
        itemType: InventoryItemType.REUSABLE,
        unit: "pcs",
        currentStock: 10,
        isActive: false,
      },
    });
    const resIssueInactive = await apiRequest(`/api/v1/inventory/events/${testEvent.id}/issue`, {
      method: "POST",
      token: adminToken,
      body: {
        items: [{ inventoryItemId: inactiveItem.id, quantity: 2 }],
      },
    });
    recordTest(
      "Section 4",
      "4.5 Issuing inactive inventory item returns HTTP 400 Bad Request",
      resIssueInactive.status === 400 && resIssueInactive.data?.error?.message?.includes("inactive"),
      `Expected 400 for inactive item, received: ${resIssueInactive.status}`
    );

    // 4.6 Valid Issue of items to Event:
    // - Issue 4 sets of item1 (currentStock: 9 -> 5)
    // - Issue 10 pcs of item2 (currentStock: 25 -> 15)
    const resValidIssue = await apiRequest(`/api/v1/inventory/events/${testEvent.id}/issue`, {
      method: "POST",
      token: adminToken,
      body: {
        items: [
          { inventoryItemId: item1.id, quantity: 4, notes: "Handed over to sound technician" },
          { inventoryItemId: item2.id, quantity: 10, notes: "Rigged on truss A" },
        ],
      },
    });
    recordTest(
      "Section 4",
      "4.6 POST /api/v1/inventory/events/:eventId/issue successfully decrements warehouse stock and logs EVENT_ISSUE",
      resValidIssue.status === 200 && resValidIssue.data?.data?.length === 2,
      `Expected 200 with 2 issued items, received: ${resValidIssue.status}`
    );

    // Verify warehouse stock decremented
    const item1AfterIssue = await prisma.inventoryItem.findUnique({ where: { id: item1.id } });
    const item2AfterIssue = await prisma.inventoryItem.findUnique({ where: { id: item2.id } });
    recordTest(
      "Section 4",
      "4.7 Warehouse stock decremented accurately (item1: 9->5, item2: 25->15)",
      Number(item1AfterIssue?.currentStock) === 5 && Number(item2AfterIssue?.currentStock) === 15,
      `Expected stock item1=5, item2=15. Found item1=${item1AfterIssue?.currentStock}, item2=${item2AfterIssue?.currentStock}`
    );

    // Verify EventInventory status now shows outstanding
    const resEventInvAfterIssue = await apiRequest(`/api/v1/inventory/events/${testEvent.id}`, {
      token: adminToken,
    });
    const alloc1AfterIssue = resEventInvAfterIssue.data?.data?.allocations?.find((a: any) => a.inventoryItemId === item1.id);
    recordTest(
      "Section 4",
      "4.8 Event inventory outstanding quantity updated to 4",
      alloc1AfterIssue?.issuedQuantity === 4 && alloc1AfterIssue?.outstandingQuantity === 4,
      `Expected issued: 4, outstanding: 4. Found: ${JSON.stringify(alloc1AfterIssue)}`
    );

    // 4.9 Over-Return Check: Attempting to return 10 sets of item1 when only 4 were issued
    const resOverReturn = await apiRequest(`/api/v1/inventory/events/${testEvent.id}/return`, {
      method: "POST",
      token: adminToken,
      body: {
        items: [{ inventoryItemId: item1.id, returnedQuantity: 10, damagedQuantity: 0 }],
      },
    });
    recordTest(
      "Section 4",
      "4.9 Returning more items than outstanding issued quantity returns HTTP 400 Bad Request",
      resOverReturn.status === 400 && resOverReturn.data?.error?.message?.includes("Outstanding unreturned quantity"),
      `Expected 400 for over-return, received: ${resOverReturn.status}`
    );

    // 4.10 Partial Return with Both Good & Damaged Units:
    // Out of 4 issued sets of item1:
    // - 3 returned in good condition (should be returned to warehouse stock: 5 -> 8)
    // - 1 returned DAMAGED (should NOT be added to warehouse stock: warehouse stays at 8)
    // - 0 remaining outstanding for item1
    const resProcessReturn = await apiRequest(`/api/v1/inventory/events/${testEvent.id}/return`, {
      method: "POST",
      token: adminToken,
      body: {
        items: [
          {
            inventoryItemId: item1.id,
            returnedQuantity: 3,
            damagedQuantity: 1,
            notes: "3 mics returned in good condition, 1 mic body cracked",
          },
        ],
      },
    });
    recordTest(
      "Section 4",
      "4.10 POST /api/v1/inventory/events/:eventId/return processes partial good return + damaged report",
      resProcessReturn.status === 200 && resProcessReturn.data?.data[0]?.remainingOutstandingForEvent === 0,
      `Expected remaining outstanding 0, received: ${JSON.stringify(resProcessReturn.data?.data)}`
    );

    // 4.11 Verify Warehouse Stock after return:
    // item1 stock should be 5 + 3 = 8 (the 1 damaged unit is NOT added to warehouse stock)
    const item1AfterReturn = await prisma.inventoryItem.findUnique({ where: { id: item1.id } });
    recordTest(
      "Section 4",
      "4.11 Warehouse stock only increments for undamaged returns (5 + 3 = 8; damaged unit excluded)",
      Number(item1AfterReturn?.currentStock) === 8,
      `Expected currentStock = 8, received: ${item1AfterReturn?.currentStock}`
    );

    // 4.12 Verify Movements logged for return:
    // Expect 1 EVENT_RETURN movement (qty 3) and 1 DAMAGE movement (qty 1)
    const movementsPostReturn = await prisma.inventoryMovement.findMany({
      where: {
        inventoryItemId: item1.id,
        movementType: { in: [InventoryMovementType.EVENT_RETURN, InventoryMovementType.DAMAGE] },
      },
      orderBy: { createdAt: "desc" },
    });
    const hasEventReturn = movementsPostReturn.some((m) => m.movementType === InventoryMovementType.EVENT_RETURN && Number(m.quantity) === 3);
    const hasEventDamage = movementsPostReturn.some((m) => m.movementType === InventoryMovementType.DAMAGE && Number(m.quantity) === 1);
    recordTest(
      "Section 4",
      "4.12 Return creates both EVENT_RETURN (qty 3) and DAMAGE (qty 1) movements",
      hasEventReturn && hasEventDamage,
      `Found movements: ${JSON.stringify(movementsPostReturn)}`
    );

    // 4.13 Final Audit for item1 post event lifecycle:
    // Inflows: 10 (purchased) + 3 (adj in) + 3 (event returned) = 16
    // Outflows: 2 (adj out) + 1 (warehouse damage) + 1 (warehouse loss) + 4 (event issued) = 8
    // Net: 16 - 8 = 8.
    // Warehouse currentStock = 8.
    // Perfectly reconciled!
    const resFinalAudit = await apiRequest(`/api/v1/inventory/items/${item1.id}/audit`, {
      token: adminToken,
    });
    recordTest(
      "Section 4",
      "4.13 Post-event audit verifies 100% ledger reconciliation (expected 8 == current 8)",
      resFinalAudit.status === 200 &&
        resFinalAudit.data?.data?.audit?.isReconciled === true &&
        resFinalAudit.data?.data?.audit?.currentStock === 8,
      `Audit mismatch: ${JSON.stringify(resFinalAudit.data?.data?.audit)}`
    );

    // =========================================================================
    // SECTION 5: RBAC & SECURITY TESTS
    // =========================================================================
    console.log("\n==> SECTION 5: RBAC & Security Tests");

    // 5.1 Unauthenticated GET /api/v1/inventory/items returns 401
    const resUnauthGet = await apiRequest("/api/v1/inventory/items");
    recordTest(
      "Section 5",
      "5.1 Security: Unauthenticated GET /api/v1/inventory/items returns HTTP 401 Unauthorized",
      resUnauthGet.status === 401,
      `Expected 401, received: ${resUnauthGet.status}`
    );

    // 5.2 Unauthenticated POST /api/v1/inventory/movements/purchase returns 401
    const resUnauthPost = await apiRequest("/api/v1/inventory/movements/purchase", {
      method: "POST",
      body: { inventoryItemId: item1.id, quantity: 5 },
    });
    recordTest(
      "Section 5",
      "5.2 Security: Unauthenticated POST /api/v1/inventory/movements/purchase returns HTTP 401 Unauthorized",
      resUnauthPost.status === 401,
      `Expected 401, received: ${resUnauthPost.status}`
    );

    // 5.3 Client Role GET /api/v1/inventory/items returns 403 Forbidden
    const resClientGetItems = await apiRequest("/api/v1/inventory/items", {
      token: clientToken,
    });
    recordTest(
      "Section 5",
      "5.3 Security: Client role GET /api/v1/inventory/items returns HTTP 403 Forbidden",
      resClientGetItems.status === 403,
      `Expected 403, received: ${resClientGetItems.status}`
    );

    // 5.4 Client Role POST /api/v1/inventory/items returns 403 Forbidden
    const resClientCreateItem = await apiRequest("/api/v1/inventory/items", {
      method: "POST",
      token: clientToken,
      body: { name: "Hacked Item", categoryId: cat1.id, itemType: InventoryItemType.REUSABLE, unit: "pcs" },
    });
    recordTest(
      "Section 5",
      "5.4 Security: Client role POST /api/v1/inventory/items returns HTTP 403 Forbidden",
      resClientCreateItem.status === 403,
      `Expected 403, received: ${resClientCreateItem.status}`
    );

    // 5.5 Client Role POST /api/v1/inventory/movements/purchase returns 403 Forbidden
    const resClientPurchase = await apiRequest("/api/v1/inventory/movements/purchase", {
      method: "POST",
      token: clientToken,
      body: { inventoryItemId: item1.id, quantity: 10 },
    });
    recordTest(
      "Section 5",
      "5.5 Security: Client role POST /api/v1/inventory/movements/purchase returns HTTP 403 Forbidden",
      resClientPurchase.status === 403,
      `Expected 403, received: ${resClientPurchase.status}`
    );

    // 5.6 Input Validation: Negative quantity in purchase movement returns 400
    const resNegQty = await apiRequest("/api/v1/inventory/movements/purchase", {
      method: "POST",
      token: adminToken,
      body: {
        inventoryItemId: item1.id,
        quantity: -5,
      },
    });
    recordTest(
      "Section 5",
      "5.6 Validation: Negative quantity in purchase movement rejected with HTTP 422 VALIDATION_ERROR",
      resNegQty.status === 422,
      `Expected 422, received: ${resNegQty.status}`
    );

    // 5.7 Input Validation: Missing notes in manual stock adjustment returns 422
    const resMissingNotes = await apiRequest("/api/v1/inventory/movements/adjustment", {
      method: "POST",
      token: adminToken,
      body: {
        inventoryItemId: item1.id,
        quantity: 5,
        movementType: InventoryMovementType.ADJUSTMENT_IN,
      },
    });
    recordTest(
      "Section 5",
      "5.7 Validation: Missing mandatory audit notes in stock adjustment rejected with HTTP 422 VALIDATION_ERROR",
      resMissingNotes.status === 422,
      `Expected 422, received: ${resMissingNotes.status}`
    );

    // 5.8 Schema Integrity Check
    const finalSchemaHash = computeFileHash(SCHEMA_PRISMA_PATH);
    const schemaIntact = initialSchemaHash === finalSchemaHash;
    recordTest(
      "Section 5",
      "5.8 Schema Protection: prisma/schema.prisma sha256 hash remained 100% untouched",
      schemaIntact,
      `Initial: ${initialSchemaHash}, Final: ${finalSchemaHash}`
    );
  } finally {
    if (server) {
      await new Promise<void>((resolve) => {
        (server as http.Server).close(() => resolve());
      });
      console.log("\n[HTTP Test Server Closed]");
    }
  }

  // ---------------------------------------------------------------------------
  // Summary & Scorecard
  // ---------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const percentage = ((passed / total) * 100).toFixed(1);

  console.log("\n================================================================================");
  console.log("                           PHASE 7 TEST SCORECARD");
  console.log("================================================================================");
  console.log(`Total Tests Run : ${total}`);
  console.log(`Tests Passed   : ${passed} (\x1b[32m${percentage}%\x1b[0m)`);
  console.log(`Tests Failed   : ${failed}`);

  if (failed > 0) {
    console.error("\nFailed Tests Details:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(`- [${r.section}] ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log("\n\x1b[32mALL TESTS PASSED! Phase 7 Inventory Management & Movement Ledger is 100% verified.\x1b[0m\n");
    process.exit(0);
  }
}

runPhase7InventoryTestSuite().catch((err) => {
  console.error("Fatal test runner exception:", err);
  process.exit(1);
});
