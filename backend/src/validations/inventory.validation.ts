import { z } from "zod";
import { InventoryItemType, InventoryMovementType } from "../generated/prisma/enums.js";

// ==========================================
// CATEGORY VALIDATION SCHEMAS
// ==========================================

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(100, "Category name cannot exceed 100 characters"),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name cannot be empty").max(100, "Category name cannot exceed 100 characters").optional(),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
});

// ==========================================
// ITEM VALIDATION SCHEMAS
// ==========================================

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(255, "Item name cannot exceed 255 characters"),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  categoryId: z.string().uuid("Invalid category ID format"),
  itemType: z.nativeEnum(InventoryItemType, {
    message: "Valid itemType is required (REUSABLE or CONSUMABLE)",
  }),
  sku: z
    .string()
    .trim()
    .max(50, "SKU cannot exceed 50 characters")
    .transform((val) => (val === "" ? null : val.toUpperCase()))
    .optional()
    .nullable(),
  unit: z.string().trim().min(1, "Unit of measurement is required (e.g. pcs, sets, kg)").max(50),
  minimumStock: z.coerce.number().min(0, "minimumStock cannot be negative").default(0),
  purchasePrice: z.coerce.number().min(0, "purchasePrice cannot be negative").optional().nullable(),
  initialStock: z.coerce.number().min(0, "initialStock cannot be negative").default(0),
  isActive: z.boolean().default(true),
});

export const updateInventoryItemSchema = z.object({
  name: z.string().trim().min(1, "Item name cannot be empty").max(255).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  categoryId: z.string().uuid("Invalid category ID format").optional(),
  itemType: z.nativeEnum(InventoryItemType).optional(),
  sku: z
    .string()
    .trim()
    .max(50)
    .transform((val) => (val === "" ? null : val.toUpperCase()))
    .optional()
    .nullable(),
  unit: z.string().trim().min(1, "Unit cannot be empty").max(50).optional(),
  minimumStock: z.coerce.number().min(0, "minimumStock cannot be negative").optional(),
  purchasePrice: z.coerce.number().min(0, "purchasePrice cannot be negative").optional().nullable(),
  isActive: z.boolean().optional(),
});

export const inventoryItemQuerySchema = z.object({
  categoryId: z.string().uuid("Invalid category ID format").optional(),
  itemType: z.nativeEnum(InventoryItemType).optional(),
  lowStock: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==========================================
// STOCK MOVEMENT SCHEMAS
// ==========================================

export const purchaseMovementSchema = z.object({
  inventoryItemId: z.string().uuid("Invalid inventory item ID format"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitCost: z.coerce.number().min(0, "unitCost cannot be negative").optional().nullable(),
  referenceNumber: z.string().trim().max(100, "Reference number cannot exceed 100 characters").optional().nullable(),
  notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional().nullable(),
  movementDate: z.coerce.date().optional(),
});

export const adjustmentMovementSchema = z.object({
  inventoryItemId: z.string().uuid("Invalid inventory item ID format"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  movementType: z.enum([InventoryMovementType.ADJUSTMENT_IN, InventoryMovementType.ADJUSTMENT_OUT], {
    message: "Adjustment movementType must be ADJUSTMENT_IN or ADJUSTMENT_OUT",
  }),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().min(1, "Reason/notes are required for manual stock adjustment").max(500),
  movementDate: z.coerce.date().optional(),
});

export const damageLossMovementSchema = z.object({
  inventoryItemId: z.string().uuid("Invalid inventory item ID format"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  movementType: z.enum([InventoryMovementType.DAMAGE, InventoryMovementType.LOSS], {
    message: "Movement type must be DAMAGE or LOSS",
  }),
  notes: z.string().trim().min(1, "Reason/notes are required for damage or loss entry").max(500),
  movementDate: z.coerce.date().optional(),
});

export const movementQuerySchema = z.object({
  inventoryItemId: z.string().uuid("Invalid inventory item ID format").optional(),
  eventId: z.string().uuid("Invalid event ID format").optional(),
  movementType: z.nativeEnum(InventoryMovementType).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==========================================
// EVENT INVENTORY ALLOCATION & MOVEMENT SCHEMAS
// ==========================================

export const allocateEventItemSingleSchema = z.object({
  inventoryItemId: z.string().uuid("Invalid inventory item ID format"),
  requiredQuantity: z.coerce.number().min(0, "Required quantity cannot be negative"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const allocateEventItemsSchema = z.object({
  items: z.array(allocateEventItemSingleSchema).min(1, "At least one item allocation is required"),
});

export const issueEventItemSingleSchema = z.object({
  inventoryItemId: z.string().uuid("Invalid inventory item ID format"),
  quantity: z.coerce.number().positive("Quantity to issue must be greater than 0"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const issueEventItemsSchema = z.object({
  items: z.array(issueEventItemSingleSchema).min(1, "At least one item to issue is required"),
});

export const returnEventItemSingleSchema = z
  .object({
    inventoryItemId: z.string().uuid("Invalid inventory item ID format"),
    returnedQuantity: z.coerce.number().min(0, "returnedQuantity cannot be negative").default(0),
    damagedQuantity: z.coerce.number().min(0, "damagedQuantity cannot be negative").default(0),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (data) => data.returnedQuantity + data.damagedQuantity > 0,
    {
      message: "Combined returnedQuantity and damagedQuantity must be greater than 0",
      path: ["returnedQuantity"],
    }
  );

export const returnEventItemsSchema = z.object({
  items: z.array(returnEventItemSingleSchema).min(1, "At least one return item entry is required"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type InventoryItemQueryInput = z.infer<typeof inventoryItemQuerySchema>;
export type PurchaseMovementInput = z.infer<typeof purchaseMovementSchema>;
export type AdjustmentMovementInput = z.infer<typeof adjustmentMovementSchema>;
export type DamageLossMovementInput = z.infer<typeof damageLossMovementSchema>;
export type MovementQueryInput = z.infer<typeof movementQuerySchema>;
export type AllocateEventItemsInput = z.infer<typeof allocateEventItemsSchema>;
export type IssueEventItemsInput = z.infer<typeof issueEventItemsSchema>;
export type ReturnEventItemsInput = z.infer<typeof returnEventItemsSchema>;
