/**
 * Inventory API Service
 * Handles communication with backend inventory endpoints prefixed with `/inventory`
 */

import { apiClient } from "@/lib/api";
import type {
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
  EventInventoryAllocation,
  EventInventoryDetailsResponse,
  InventoryItemListResponse,
  InventoryMovementListResponse,
  ItemAuditResponse,
  IssueEventItemResult,
  ReturnEventItemResult,
  RecordMovementResponse,
} from "@/types/inventory.types";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryItemQueryInput,
  PurchaseMovementInput,
  AdjustmentMovementInput,
  DamageLossMovementInput,
  MovementQueryInput,
  AllocateEventItemsInput,
  UpdateEventItemInput,
  IssueEventItemsInput,
  ReturnEventItemsInput,
} from "../schemas/inventory.schema";

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (value instanceof Date) {
        searchParams.append(key, value.toISOString());
      } else {
        searchParams.append(key, String(value));
      }
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

export const inventoryService = {
  // ==========================================
  // CATEGORIES API
  // ==========================================

  /**
   * Fetch all inventory categories
   */
  async getCategories(): Promise<InventoryCategory[]> {
    const res = await apiClient<InventoryCategory[]>("/inventory/categories", {
      method: "GET",
    });
    return res.data ?? [];
  },

  /**
   * Fetch a single inventory category by ID
   */
  async getCategoryById(id: string): Promise<InventoryCategory> {
    const res = await apiClient<InventoryCategory>(`/inventory/categories/${id}`, {
      method: "GET",
    });
    if (!res.data) {
      throw new Error(res.message || `Category ${id} not found`);
    }
    return res.data;
  },

  /**
   * Create a new inventory category
   */
  async createCategory(payload: CreateCategoryInput): Promise<InventoryCategory> {
    const res = await apiClient<InventoryCategory>("/inventory/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.data) {
      throw new Error(res.message || "Failed to create inventory category");
    }
    return res.data;
  },

  /**
   * Update an existing inventory category
   */
  async updateCategory(
    id: string,
    payload: UpdateCategoryInput
  ): Promise<InventoryCategory> {
    const res = await apiClient<InventoryCategory>(`/inventory/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!res.data) {
      throw new Error(res.message || "Failed to update inventory category");
    }
    return res.data;
  },

  /**
   * Delete an inventory category
   */
  async deleteCategory(id: string): Promise<{ id: string; name: string }> {
    const res = await apiClient<{ id: string; name: string }>(
      `/inventory/categories/${id}`,
      {
        method: "DELETE",
      }
    );
    if (!res.data) {
      return { id, name: "" };
    }
    return res.data;
  },

  // ==========================================
  // ITEMS API
  // ==========================================

  /**
   * Fetch paginated list of inventory items with optional filters
   */
  async getItems(
    params?: InventoryItemQueryInput
  ): Promise<InventoryItemListResponse> {
    const qs = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient<InventoryItem[]>(`/inventory/items${qs}`, {
      method: "GET",
    });
    return {
      items: res.data ?? [],
      meta: res.meta,
    };
  },

  /**
   * Fetch a single inventory item by ID
   */
  async getItemById(id: string): Promise<InventoryItem> {
    const res = await apiClient<InventoryItem>(`/inventory/items/${id}`, {
      method: "GET",
    });
    if (!res.data) {
      throw new Error(res.message || `Inventory item ${id} not found`);
    }
    return res.data;
  },

  /**
   * Create a new inventory item
   */
  async createItem(payload: CreateInventoryItemInput): Promise<InventoryItem> {
    const res = await apiClient<InventoryItem>("/inventory/items", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.data) {
      throw new Error(res.message || "Failed to create inventory item");
    }
    return res.data;
  },

  /**
   * Update an existing inventory item
   */
  async updateItem(
    id: string,
    payload: UpdateInventoryItemInput
  ): Promise<InventoryItem> {
    const res = await apiClient<InventoryItem>(`/inventory/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!res.data) {
      throw new Error(res.message || "Failed to update inventory item");
    }
    return res.data;
  },

  /**
   * Delete an inventory item
   */
  async deleteItem(id: string): Promise<{ id: string; name: string }> {
    const res = await apiClient<{ id: string; name: string }>(
      `/inventory/items/${id}`,
      {
        method: "DELETE",
      }
    );
    if (!res.data) {
      return { id, name: "" };
    }
    return res.data;
  },

  /**
   * Audit item stock (double-entry mathematical ledger reconciliation)
   */
  async auditItemStock(id: string): Promise<ItemAuditResponse> {
    const res = await apiClient<ItemAuditResponse>(`/inventory/items/${id}/audit`, {
      method: "GET",
    });
    if (!res.data) {
      throw new Error(res.message || `Failed to audit item ${id}`);
    }
    return res.data;
  },

  // ==========================================
  // MOVEMENTS API
  // ==========================================

  /**
   * Fetch paginated list of stock movements
   */
  async getMovements(
    params?: MovementQueryInput
  ): Promise<InventoryMovementListResponse> {
    const qs = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient<InventoryMovement[]>(`/inventory/movements${qs}`, {
      method: "GET",
    });
    return {
      movements: res.data ?? [],
      meta: res.meta,
    };
  },

  /**
   * Record inventory purchase (inflow)
   */
  async recordPurchase(
    payload: PurchaseMovementInput
  ): Promise<RecordMovementResponse> {
    const res = await apiClient<RecordMovementResponse>(
      "/inventory/movements/purchase",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to record purchase movement");
    }
    return res.data;
  },

  /**
   * Record manual stock adjustment (ADJUSTMENT_IN or ADJUSTMENT_OUT)
   */
  async recordAdjustment(
    payload: AdjustmentMovementInput
  ): Promise<RecordMovementResponse> {
    const res = await apiClient<RecordMovementResponse>(
      "/inventory/movements/adjustment",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to record stock adjustment");
    }
    return res.data;
  },

  /**
   * Record warehouse stock damage or loss write-off
   */
  async recordDamageLoss(
    payload: DamageLossMovementInput
  ): Promise<RecordMovementResponse> {
    const res = await apiClient<RecordMovementResponse>(
      "/inventory/movements/damage-loss",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to record damage/loss movement");
    }
    return res.data;
  },

  // ==========================================
  // EVENT LOGISTICS & RENTAL SERVICES API
  // ==========================================

  /**
   * Get event inventory allocations and financial/unit summary
   */
  async getEventInventory(
    eventId: string
  ): Promise<EventInventoryDetailsResponse> {
    const res = await apiClient<EventInventoryDetailsResponse>(
      `/inventory/events/${eventId}`,
      {
        method: "GET",
      }
    );
    if (!res.data) {
      throw new Error(res.message || `Event inventory for ${eventId} not found`);
    }
    return res.data;
  },

  /**
   * Allocate equipment (owned or rented) to an event
   */
  async allocateEventItems(
    eventId: string,
    payload: AllocateEventItemsInput
  ): Promise<EventInventoryAllocation[]> {
    const res = await apiClient<EventInventoryAllocation[]>(
      `/inventory/events/${eventId}/allocate`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return res.data ?? [];
  },

  /**
   * Update allocated event item terms, rates, or rental dates
   */
  async updateEventItem(
    eventId: string,
    itemId: string,
    payload: UpdateEventItemInput
  ): Promise<EventInventoryAllocation> {
    const res = await apiClient<EventInventoryAllocation>(
      `/inventory/events/${eventId}/items/${itemId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to update event item allocation");
    }
    return res.data;
  },

  /**
   * Issue / dispatch equipment to an event
   */
  async issueEventItems(
    eventId: string,
    payload: IssueEventItemsInput
  ): Promise<IssueEventItemResult[]> {
    const res = await apiClient<IssueEventItemResult[]>(
      `/inventory/events/${eventId}/issue`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return res.data ?? [];
  },

  /**
   * Return equipment from event (with good vs damaged unit reporting)
   */
  async returnEventItems(
    eventId: string,
    payload: ReturnEventItemsInput
  ): Promise<ReturnEventItemResult[]> {
    const res = await apiClient<ReturnEventItemResult[]>(
      `/inventory/events/${eventId}/return`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return res.data ?? [];
  },
};
