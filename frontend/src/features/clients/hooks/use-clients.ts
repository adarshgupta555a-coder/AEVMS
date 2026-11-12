"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  clientService,
  type ClientListResponse,
  type ClientEventsResponse,
  type ClientQuotationsResponse,
  type ClientInvoicesResponse,
  type ClientPaymentsResponse,
} from "../services/client.service";
import type {
  ClientQueryInput,
  CreateClientInput,
  UpdateClientInput,
  AssignPortalInput,
  UpdateClientStatusInput,
  CreateClientActivityInput,
  ClientDetail,
  ClientItem,
  PortalStatusResponse,
  AssignPortalResponse,
  UpdateClientStatusResponse,
} from "../schemas/client.schema";
import type { CalendarEntry } from "@/types/models";

/**
 * Query Key Factory for Client domain
 */
export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  list: (params?: ClientQueryInput) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, "detail"] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  portalStatus: (id: string) => [...clientKeys.detail(id), "portal-status"] as const,
  events: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
    [...clientKeys.detail(id), "events", params] as const,
  quotations: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
    [...clientKeys.detail(id), "quotations", params] as const,
  invoices: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
    [...clientKeys.detail(id), "invoices", params] as const,
  payments: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
    [...clientKeys.detail(id), "payments", params] as const,
  activities: (id: string, params?: { page?: number; limit?: number; type?: string }) =>
    [...clientKeys.detail(id), "activities", params] as const,
};

/**
 * Hook to retrieve paginated list of clients
 */
export function useClients(params?: ClientQueryInput) {
  return useQuery<ClientListResponse, Error>({
    queryKey: clientKeys.list(params),
    queryFn: () => clientService.getClients(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve full details of a single client
 */
export function useClient(id: string) {
  return useQuery<ClientDetail, Error>({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientService.getClientById(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve client portal access status
 */
export function useClientPortalStatus(id: string) {
  return useQuery<PortalStatusResponse, Error>({
    queryKey: clientKeys.portalStatus(id),
    queryFn: () => clientService.getPortalStatus(id),
    enabled: Boolean(id),
    staleTime: 15 * 1000,
  });
}

/**
 * Hook to retrieve client's linked events
 */
export function useClientEvents(
  id: string,
  params?: { page?: number; limit?: number; status?: string }
) {
  return useQuery<ClientEventsResponse, Error>({
    queryKey: clientKeys.events(id, params),
    queryFn: () => clientService.getClientEvents(id, params),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve client's quotations
 */
export function useClientQuotations(
  id: string,
  params?: { page?: number; limit?: number; status?: string }
) {
  return useQuery<ClientQuotationsResponse, Error>({
    queryKey: clientKeys.quotations(id, params),
    queryFn: () => clientService.getClientQuotations(id, params),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve client's invoices
 */
export function useClientInvoices(
  id: string,
  params?: { page?: number; limit?: number; status?: string }
) {
  return useQuery<ClientInvoicesResponse, Error>({
    queryKey: clientKeys.invoices(id, params),
    queryFn: () => clientService.getClientInvoices(id, params),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve client's payments
 */
export function useClientPayments(
  id: string,
  params?: { page?: number; limit?: number; status?: string }
) {
  return useQuery<ClientPaymentsResponse, Error>({
    queryKey: clientKeys.payments(id, params),
    queryFn: () => clientService.getClientPayments(id, params),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve client's logged activities and meetings
 */
export function useClientActivities(
  id: string,
  params?: { page?: number; limit?: number; type?: string }
) {
  return useQuery<CalendarEntry[], Error>({
    queryKey: clientKeys.activities(id, params),
    queryFn: () => clientService.getClientActivities(id, params),
    enabled: Boolean(id),
    staleTime: 15 * 1000,
  });
}

/**
 * Mutation to create a new client
 */
export function useCreateClientMutation() {
  const queryClient = useQueryClient();

  return useMutation<ClientItem, Error, CreateClientInput>({
    mutationFn: (data) => clientService.createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

/**
 * Mutation to update client profile
 */
export function useUpdateClientMutation() {
  const queryClient = useQueryClient();

  return useMutation<ClientItem, Error, { id: string; data: UpdateClientInput }>({
    mutationFn: ({ id, data }) => clientService.updateClient(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

/**
 * Mutation to delete a client
 */
export function useDeleteClientMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => clientService.deleteClient(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: clientKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

/**
 * Mutation to assign portal credentials to client
 */
export function useAssignPortalMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    AssignPortalResponse,
    Error,
    { id: string; data?: AssignPortalInput }
  >({
    mutationFn: ({ id, data }) => clientService.assignPortal(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.portalStatus(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

/**
 * Mutation to resend portal invitation
 */
export function useResendInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    AssignPortalResponse,
    Error,
    { id: string; data?: AssignPortalInput }
  >({
    mutationFn: ({ id, data }) => clientService.resendInvite(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.portalStatus(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

/**
 * Mutation to activate or deactivate client portal access
 */
export function useUpdateClientStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateClientStatusResponse,
    Error,
    { id: string; data: UpdateClientStatusInput }
  >({
    mutationFn: ({ id, data }) => clientService.updateClientStatus(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.portalStatus(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

/**
 * Mutation to create a CRM activity for a client
 */
export function useCreateClientActivityMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    CalendarEntry,
    Error,
    { id: string; data: CreateClientActivityInput }
  >({
    mutationFn: ({ id, data }) => clientService.createClientActivity(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
    },
  });
}
