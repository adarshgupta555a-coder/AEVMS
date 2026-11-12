"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  quotationService,
  type QuotationListResponse,
} from "../services/quotation.service";
import type {
  QuotationQueryInput,
  CreateQuotationInput,
  UpdateQuotationInput,
  UpdateQuotationStatusInput,
  ConvertToEventInput,
  QuotationWithRelations,
  ConvertToEventResponse,
} from "../schemas/quotation.schema";

/**
 * TanStack Query Key Factory for Quotation domain
 */
export const quotationKeys = {
  all: ["quotations"] as const,
  lists: () => [...quotationKeys.all, "list"] as const,
  list: (params?: QuotationQueryInput) => [...quotationKeys.lists(), params] as const,
  details: () => [...quotationKeys.all, "detail"] as const,
  detail: (id: string) => [...quotationKeys.details(), id] as const,
};

/**
 * Hook to retrieve paginated/filtered list of quotations
 */
export function useQuotations(params?: QuotationQueryInput) {
  return useQuery<QuotationListResponse, Error>({
    queryKey: quotationKeys.list(params),
    queryFn: () => quotationService.getQuotations(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single quotation by ID
 */
export function useQuotation(id: string) {
  return useQuery<QuotationWithRelations, Error>({
    queryKey: quotationKeys.detail(id),
    queryFn: () => quotationService.getQuotationById(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation to create a new quotation
 */
export function useCreateQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation<QuotationWithRelations, Error, CreateQuotationInput>({
    mutationFn: (data) => quotationService.createQuotation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

/**
 * Mutation to update an existing quotation
 */
export function useUpdateQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    QuotationWithRelations,
    Error,
    { id: string; data: UpdateQuotationInput }
  >({
    mutationFn: ({ id, data }) => quotationService.updateQuotation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

/**
 * Mutation to transition quotation lifecycle status
 */
export function useUpdateQuotationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    QuotationWithRelations,
    Error,
    { id: string; data: UpdateQuotationStatusInput }
  >({
    mutationFn: ({ id, data }) => quotationService.updateQuotationStatus(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

/**
 * Mutation to convert an accepted quotation to a confirmed Event
 */
export function useConvertToEventMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    ConvertToEventResponse,
    Error,
    { id: string; data: ConvertToEventInput }
  >({
    mutationFn: ({ id, data }) => quotationService.convertToEvent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: quotationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
      // Invalidate events cache to immediately show new event in events register
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

/**
 * Mutation to delete a quotation
 */
export function useDeleteQuotationMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; message: string }, Error, string>({
    mutationFn: (id) => quotationService.deleteQuotation(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: quotationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}
