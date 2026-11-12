"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  paymentService,
} from "../services/payment.service";
import type {
  PaymentQueryInput,
  CreatePaymentInput,
  PaymentDetail,
  PaymentListResponse,
  ClientPendingInvoice,
} from "../schemas/payment.schema";

/**
 * Query Key Factory for Payment domain
 */
export const paymentKeys = {
  all: ["payments"] as const,
  lists: () => [...paymentKeys.all, "list"] as const,
  list: (params?: PaymentQueryInput) => [...paymentKeys.lists(), params] as const,
  details: () => [...paymentKeys.all, "detail"] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,
  clientPendingInvoices: (clientId: string) =>
    ["clients", clientId, "pending-invoices"] as const,
};

/**
 * Hook to retrieve paginated list of payments
 */
export function usePayments(params?: PaymentQueryInput) {
  return useQuery<PaymentListResponse, Error>({
    queryKey: paymentKeys.list(params),
    queryFn: () => paymentService.getPayments(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single payment by ID
 */
export function usePayment(id: string) {
  return useQuery<PaymentDetail, Error>({
    queryKey: paymentKeys.detail(id),
    queryFn: () => paymentService.getPaymentById(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to fetch pending/partially paid/sent invoices for a specific client
 */
export function useClientPendingInvoices(clientId: string) {
  return useQuery<ClientPendingInvoice[], Error>({
    queryKey: paymentKeys.clientPendingInvoices(clientId),
    queryFn: () => paymentService.getClientPendingInvoices(clientId),
    enabled: Boolean(clientId),
    staleTime: 10 * 1000,
  });
}

/**
 * Mutation hook to record a new payment with multi-invoice allocations
 */
export function useRecordPaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation<PaymentDetail, Error, CreatePaymentInput>({
    mutationFn: (data: CreatePaymentInput) => paymentService.recordPayment(data),
    onSuccess: (newPayment) => {
      // Invalidate payments list and detail caches
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      // Invalidate invoices caches so updated balances and statuses reflect immediately
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      // Invalidate clients caches
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      // Invalidate events caches (financial summaries)
      queryClient.invalidateQueries({ queryKey: ["events"] });

      if (newPayment.clientId) {
        queryClient.invalidateQueries({
          queryKey: paymentKeys.clientPendingInvoices(newPayment.clientId),
        });
      }
    },
  });
}

/**
 * Mutation hook to delete a payment and roll back invoice allocations
 */
export function useDeletePaymentMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error, string>({
    mutationFn: (id: string) => paymentService.deletePayment(id),
    onSuccess: () => {
      // Invalidate payments, invoices, clients, and events
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
