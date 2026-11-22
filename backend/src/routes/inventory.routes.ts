import { Router } from "express";
import { inventoryController } from "../controllers/inventory.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import {
  createCategorySchema,
  updateCategorySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  inventoryItemQuerySchema,
  purchaseMovementSchema,
  adjustmentMovementSchema,
  damageLossMovementSchema,
  movementQuerySchema,
  allocateEventItemsSchema,
  updateEventItemSchema,
  issueEventItemsSchema,
  returnEventItemsSchema,
} from "../validations/inventory.validation.js";

const router = Router();

// Protect all inventory routes: Requires authenticated Admin
router.use(authenticate);
router.use(requireAdmin);

// ==========================================
// CATEGORY ROUTES
// ==========================================
router.get("/categories", (req, res, next) => inventoryController.getCategories(req, res, next));
router.post(
  "/categories",
  validateRequest({ body: createCategorySchema }),
  (req, res, next) => inventoryController.createCategory(req, res, next)
);
router.get("/categories/:id", (req, res, next) => inventoryController.getCategoryById(req, res, next));
router.put(
  "/categories/:id",
  validateRequest({ body: updateCategorySchema }),
  (req, res, next) => inventoryController.updateCategory(req, res, next)
);
router.delete("/categories/:id", (req, res, next) => inventoryController.deleteCategory(req, res, next));

// ==========================================
// ITEM ROUTES
// ==========================================
router.get(
  "/items",
  validateRequest({ query: inventoryItemQuerySchema }),
  (req, res, next) => inventoryController.getItems(req, res, next)
);
router.post(
  "/items",
  validateRequest({ body: createInventoryItemSchema }),
  (req, res, next) => inventoryController.createItem(req, res, next)
);
router.get("/items/:id", (req, res, next) => inventoryController.getItemById(req, res, next));
router.put(
  "/items/:id",
  validateRequest({ body: updateInventoryItemSchema }),
  (req, res, next) => inventoryController.updateItem(req, res, next)
);
router.delete("/items/:id", (req, res, next) => inventoryController.deleteItem(req, res, next));
router.get("/items/:id/audit", (req, res, next) => inventoryController.auditItemStock(req, res, next));

// ==========================================
// STOCK MOVEMENT ROUTES
// ==========================================
router.get(
  "/movements",
  validateRequest({ query: movementQuerySchema }),
  (req, res, next) => inventoryController.getMovements(req, res, next)
);
router.post(
  "/movements/purchase",
  validateRequest({ body: purchaseMovementSchema }),
  (req, res, next) => inventoryController.recordPurchase(req, res, next)
);
router.post(
  "/movements/adjustment",
  validateRequest({ body: adjustmentMovementSchema }),
  (req, res, next) => inventoryController.recordAdjustment(req, res, next)
);
router.post(
  "/movements/damage-loss",
  validateRequest({ body: damageLossMovementSchema }),
  (req, res, next) => inventoryController.recordDamageLoss(req, res, next)
);

// ==========================================
// EVENT INVENTORY ALLOCATION & MOVEMENT ROUTES
// ==========================================
router.get("/events/:eventId", (req, res, next) => inventoryController.getEventInventory(req, res, next));
router.post(
  "/events/:eventId/allocate",
  validateRequest({ body: allocateEventItemsSchema }),
  (req, res, next) => inventoryController.allocateEventItems(req, res, next)
);
router.put(
  "/events/:eventId/items/:inventoryItemId",
  validateRequest({ body: updateEventItemSchema }),
  (req, res, next) => inventoryController.updateEventItem(req, res, next)
);
router.post(
  "/events/:eventId/issue",
  validateRequest({ body: issueEventItemsSchema }),
  (req, res, next) => inventoryController.issueEventItems(req, res, next)
);
router.post(
  "/events/:eventId/return",
  validateRequest({ body: returnEventItemsSchema }),
  (req, res, next) => inventoryController.returnEventItems(req, res, next)
);

export default router;
