"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "../services/inventory.service";
import type {
  InventoryCategory,
  InventoryItem,
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

/**
 * Query Key Factory for Inventory domain
 */
export const inventoryKeys = {
  all: ["inventory"] as const,

  // Categories
  categories: () => [...inventoryKeys.all, "categories"] as const,
  category: (id: string) => [...inventoryKeys.categories(), id] as const,

  // Items
  items: () => [...inventoryKeys.all, "items"] as const,
  itemList: (params?: InventoryItemQueryInput) =>
    [...inventoryKeys.items(), "list", params] as const,
  item: (id: string) => [...inventoryKeys.items(), "detail", id] as const,
  itemAudit: (id: string) => [...inventoryKeys.item(id), "audit"] as const,

  // Movements
  movements: () => [...inventoryKeys.all, "movements"] as const,
  movementList: (params?: MovementQueryInput) =>
    [...inventoryKeys.movements(), "list", params] as const,

  // Events
  events: () => [...inventoryKeys.all, "events"] as const,
  eventInventory: (eventId: string) =>
    [...inventoryKeys.events(), eventId] as const,
};

// ==========================================
// CATEGORY HOOKS
// ==========================================

/**
 * Hook to retrieve all inventory categories
 */
export function useInventoryCategories() {
  return useQuery<InventoryCategory[], Error>({
    queryKey: inventoryKeys.categories(),
    queryFn: () => inventoryService.getCategories(),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to retrieve single category by ID
 */
export function useInventoryCategory(id: string) {
  return useQuery<InventoryCategory, Error>({
    queryKey: inventoryKeys.category(id),
    queryFn: () => inventoryService.getCategoryById(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to create a new category
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation<InventoryCategory, Error, CreateCategoryInput>({
    mutationFn: (data) => inventoryService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.categories() });
    },
  });
}

/**
 * Hook to update an existing category
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation<
    InventoryCategory,
    Error,
    { id: string; data: UpdateCategoryInput }
  >({
    mutationFn: ({ id, data }) => inventoryService.updateCategory(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.categories() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.category(id) });
    },
  });
}

/**
 * Hook to delete a category
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; name: string }, Error, string>({
    mutationFn: (id) => inventoryService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.categories() });
    },
  });
}

// ==========================================
// ITEM HOOKS
// ==========================================

/**
 * Hook to retrieve paginated list of inventory items with filters
 */
export function useInventoryItems(params?: InventoryItemQueryInput) {
  return useQuery<InventoryItemListResponse, Error>({
    queryKey: inventoryKeys.itemList(params),
    queryFn: () => inventoryService.getItems(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single inventory item by ID
 */
export function useInventoryItem(id: string) {
  return useQuery<InventoryItem, Error>({
    queryKey: inventoryKeys.item(id),
    queryFn: () => inventoryService.getItemById(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to audit inventory item stock against movement history
 */
export function useItemAudit(id: string) {
  return useQuery<ItemAuditResponse, Error>({
    queryKey: inventoryKeys.itemAudit(id),
    queryFn: () => inventoryService.auditItemStock(id),
    enabled: Boolean(id),
    staleTime: 10 * 1000,
  });
}

/**
 * Hook to create a new inventory item
 */
export function useCreateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation<InventoryItem, Error, CreateInventoryItemInput>({
    mutationFn: (data) => inventoryService.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
    },
  });
}

/**
 * Hook to update an existing inventory item
 */
export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation<
    InventoryItem,
    Error,
    { id: string; data: UpdateInventoryItemInput }
  >({
    mutationFn: ({ id, data }) => inventoryService.updateItem(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.item(id) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.itemAudit(id) });
    },
  });
}

/**
 * Hook to delete an inventory item
 */
export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; name: string }, Error, string>({
    mutationFn: (id) => inventoryService.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
    },
  });
}

// ==========================================
// STOCK MOVEMENT HOOKS
// ==========================================

/**
 * Hook to retrieve paginated list of inventory movements
 */
export function useInventoryMovements(params?: MovementQueryInput) {
  return useQuery<InventoryMovementListResponse, Error>({
    queryKey: inventoryKeys.movementList(params),
    queryFn: () => inventoryService.getMovements(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to record inventory stock purchase
 */
export function useRecordPurchase() {
  const queryClient = useQueryClient();

  return useMutation<RecordMovementResponse, Error, PurchaseMovementInput>({
    mutationFn: (data) => inventoryService.recordPurchase(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.item(variables.inventoryItemId),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.itemAudit(variables.inventoryItemId),
      });
    },
  });
}

/**
 * Hook to record manual stock adjustment (ADJUSTMENT_IN or ADJUSTMENT_OUT)
 */
export function useRecordAdjustment() {
  const queryClient = useQueryClient();

  return useMutation<RecordMovementResponse, Error, AdjustmentMovementInput>({
    mutationFn: (data) => inventoryService.recordAdjustment(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.item(variables.inventoryItemId),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.itemAudit(variables.inventoryItemId),
      });
    },
  });
}

/**
 * Hook to record warehouse damage or loss write-off
 */
export function useRecordDamageLoss() {
  const queryClient = useQueryClient();

  return useMutation<RecordMovementResponse, Error, DamageLossMovementInput>({
    mutationFn: (data) => inventoryService.recordDamageLoss(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.item(variables.inventoryItemId),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.itemAudit(variables.inventoryItemId),
      });
    },
  });
}

// ==========================================
// EVENT INVENTORY ALLOCATION & LOGISTICS HOOKS
// ==========================================

/**
 * Hook to retrieve event equipment allocations and summary
 */
export function useEventInventory(eventId: string) {
  return useQuery<EventInventoryDetailsResponse, Error>({
    queryKey: inventoryKeys.eventInventory(eventId),
    queryFn: () => inventoryService.getEventInventory(eventId),
    enabled: Boolean(eventId),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to allocate equipment (owned or rented) to an event
 */
export function useAllocateEventItems() {
  const queryClient = useQueryClient();

  return useMutation<
    EventInventoryAllocation[],
    Error,
    { eventId: string; data: AllocateEventItemsInput }
  >({
    mutationFn: ({ eventId, data }) =>
      inventoryService.allocateEventItems(eventId, data),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.eventInventory(eventId),
      });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
    },
  });
}

/**
 * Hook to update allocated event item terms, rates, or rental dates
 */
export function useUpdateEventItemTerms() {
  const queryClient = useQueryClient();

  return useMutation<
    EventInventoryAllocation,
    Error,
    { eventId: string; itemId: string; data: UpdateEventItemInput }
  >({
    mutationFn: ({ eventId, itemId, data }) =>
      inventoryService.updateEventItem(eventId, itemId, data),
    onSuccess: (_, { eventId, itemId }) => {
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.eventInventory(eventId),
      });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.item(itemId),
      });
    },
  });
}

/**
 * Hook to issue equipment to an event
 */
export function useIssueEventItems() {
  const queryClient = useQueryClient();

  return useMutation<
    IssueEventItemResult[],
    Error,
    { eventId: string; data: IssueEventItemsInput }
  >({
    mutationFn: ({ eventId, data }) =>
      inventoryService.issueEventItems(eventId, data),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.eventInventory(eventId),
      });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() });
    },
  });
}

/**
 * Hook to process returns from an event
 */
export function useReturnEventItems() {
  const queryClient = useQueryClient();

  return useMutation<
    ReturnEventItemResult[],
    Error,
    { eventId: string; data: ReturnEventItemsInput }
  >({
    mutationFn: ({ eventId, data }) =>
      inventoryService.returnEventItems(eventId, data),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.eventInventory(eventId),
      });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() });
    },
  });
}
