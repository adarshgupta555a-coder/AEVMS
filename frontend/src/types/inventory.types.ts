/**
 * Inventory Domain TypeScript Types & Models
 * Matches backend domain models and documentation in `docs/inventory-frontend-guide.md`
 */

import type { PaginationMeta } from "./api.types";

export enum InventoryUsageType {
  OWNED = "OWNED",
  RENTED = "RENTED",
}

export enum InventoryItemType {
  REUSABLE = "REUSABLE",
  CONSUMABLE = "CONSUMABLE",
}

export enum InventoryMovementType {
  PURCHASE = "PURCHASE",
  EVENT_ISSUE = "EVENT_ISSUE",
  EVENT_RETURN = "EVENT_RETURN",
  DAMAGE = "DAMAGE",
  LOSS = "LOSS",
  ADJUSTMENT_IN = "ADJUSTMENT_IN",
  ADJUSTMENT_OUT = "ADJUSTMENT_OUT",
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string | null;
  _count?: {
    items: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string | null;
  categoryId: string;
  category?: InventoryCategory;
  itemType: InventoryItemType;
  sku: string | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  purchasePrice: number | null;
  isActive: boolean;
  isLowStock?: boolean;
  metrics?: {
    currentlyAllocatedToEvents: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EventInventoryAllocation {
  id: string;
  eventId: string;
  inventoryItemId: string;
  inventoryItem: InventoryItem;
  usageType: InventoryUsageType;
  requiredQuantity: number;
  issuedQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  outstandingQuantity: number;
  // Rental Service Fields
  rentalStartDate: string | null;
  rentalEndDate: string | null;
  actualReturnDate: string | null;
  rentalDays: number | null;
  rentPerUnit: number | null;
  totalRent: number | null;
  notes: string | null;
  movements?: InventoryMovement[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EventInventorySummary {
  totalAllocatedItems: number;
  ownedItemsCount: number;
  rentedItemsCount: number;
  totalRentalCost: number;
  totalOutstandingQuantity: number;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  eventInventoryId: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  unitCost: number | null;
  referenceNumber: string | null;
  notes: string | null;
  movementDate: string;
  createdAt: string;
}

export interface StockAuditBreakdown {
  inflows: {
    totalPurchased: number;
    totalAdjustedIn: number;
    totalEventReturned: number;
    totalIncrements: number;
  };
  outflows: {
    totalEventIssued: number;
    totalWarehouseDamaged: number;
    totalEventDamaged: number;
    totalWarehouseLost: number;
    totalAdjustedOut: number;
    totalDecrements: number;
  };
}

export interface StockAuditResult {
  isReconciled: boolean;
  discrepancy: number;
  expectedStock: number;
  currentStock: number;
  breakdown: StockAuditBreakdown;
}

export interface EventInventoryDetailsResponse {
  event: {
    id: string;
    eventNumber: string;
    title: string;
    status: string;
    eventDate: string | null;
  };
  summary: EventInventorySummary;
  allocations: EventInventoryAllocation[];
}

export interface ItemAuditResponse {
  item: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    currentStock: number;
    minimumStock: number;
  };
  audit: StockAuditResult;
}

export interface InventoryItemListResponse {
  items: InventoryItem[];
  meta?: PaginationMeta;
}

export interface InventoryMovementListResponse {
  movements: InventoryMovement[];
  meta?: PaginationMeta;
}

export interface IssueEventItemResult {
  itemId: string;
  itemName: string;
  usageType: InventoryUsageType;
  issuedQuantity: number;
  remainingWarehouseStock: number;
  movementId: string;
}

export interface ReturnEventItemResult {
  itemId: string;
  itemName: string;
  usageType: InventoryUsageType;
  returnedQuantity: number;
  damagedQuantity: number;
  actualReturnDate: string | null;
  remainingOutstandingForEvent: number;
}

export interface RecordMovementResponse {
  movement: InventoryMovement;
  item: InventoryItem;
}
