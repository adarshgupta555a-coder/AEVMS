"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  invoiceService,
  type InvoiceListResponse,
} from "../services/invoice.service";
import type {
  InvoiceQueryInput,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
  InvoiceWithRelations,
  InvoiceBalanceResponse,
} from "../schemas/invoice.schema";

/**
 * TanStack Query Key Factory for Invoice domain
 */
export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (params?: InvoiceQueryInput) => [...invoiceKeys.lists(), params] as const,
  details: () => [...invoiceKeys.all, "detail"] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  balances: () => [...invoiceKeys.all, "balance"] as const,
  balance: (id: string) => [...invoiceKeys.balances(), id] as const,
};

/**
 * Hook to retrieve paginated/filtered list of invoices
 */
export function useInvoices(params?: InvoiceQueryInput) {
  return useQuery<InvoiceListResponse, Error>({
    queryKey: invoiceKeys.list(params),
    queryFn: () => invoiceService.getInvoices(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single invoice by ID
 */
export function useInvoice(id: string) {
  return useQuery<InvoiceWithRelations, Error>({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => invoiceService.getInvoiceById(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve real-time invoice balance summary
 */
export function useInvoiceBalance(id: string) {
  return useQuery<InvoiceBalanceResponse, Error>({
    queryKey: invoiceKeys.balance(id),
    queryFn: () => invoiceService.calculateBalance(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation to create a new invoice
 */
export function useCreateInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation<InvoiceWithRelations, Error, CreateInvoiceInput>({
    mutationFn: (data) => invoiceService.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

/**
 * Mutation to update an existing invoice
 */
export function useUpdateInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    InvoiceWithRelations,
    Error,
    { id: string; data: UpdateInvoiceInput }
  >({
    mutationFn: ({ id, data }) => invoiceService.updateInvoice(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.balance(variables.id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

/**
 * Mutation to transition invoice lifecycle status
 */
export function useUpdateInvoiceStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    InvoiceWithRelations,
    Error,
    { id: string; data: UpdateInvoiceStatusInput }
  >({
    mutationFn: ({ id, data }) => invoiceService.updateInvoiceStatus(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.balance(variables.id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

/**
 * Mutation to delete an invoice
 */
export function useDeleteInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message?: string }, Error, string>({
    mutationFn: (id) => invoiceService.deleteInvoice(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: invoiceKeys.detail(id) });
      queryClient.removeQueries({ queryKey: invoiceKeys.balance(id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}
