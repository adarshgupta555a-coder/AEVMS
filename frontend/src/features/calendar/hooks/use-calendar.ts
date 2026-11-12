"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { calendarService } from "../services/calendar.service";
import { clientKeys } from "@/features/clients/hooks/use-clients";
import type {
  CreateCalendarEntryInput,
  UpdateCalendarEntryInput,
  CalendarQueryParams,
  CalendarListResponse,
} from "../schemas/calendar.schema";
import type { CalendarEntry } from "@/types/models";

/**
 * Standard TanStack Query Keys for Calendar Operations
 */
export const calendarKeys = {
  all: ["calendar"] as const,
  lists: () => [...calendarKeys.all, "list"] as const,
  list: (params?: CalendarQueryParams) =>
    [...calendarKeys.lists(), params] as const,
  details: () => [...calendarKeys.all, "detail"] as const,
  detail: (id: string) => [...calendarKeys.details(), id] as const,
};

/**
 * Hook to retrieve operational calendar entries with filtering
 */
export function useCalendarEntries(params?: CalendarQueryParams) {
  return useQuery<CalendarListResponse, Error>({
    queryKey: calendarKeys.list(params),
    queryFn: () => calendarService.getEntries(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve a single calendar activity entry by ID
 */
export function useCalendarEntry(id: string) {
  return useQuery<CalendarEntry, Error>({
    queryKey: calendarKeys.detail(id),
    queryFn: () => calendarService.getEntryById(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation to schedule/create a new calendar activity
 */
export function useCreateCalendarEntry() {
  const queryClient = useQueryClient();

  return useMutation<CalendarEntry, Error, CreateCalendarEntryInput>({
    mutationFn: (data: CreateCalendarEntryInput) =>
      calendarService.createEntry(data),
    onSuccess: (entry, variables) => {
      // Invalidate calendar lists
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });

      // If tied to a client, invalidate client activities timeline
      if (variables.clientId) {
        queryClient.invalidateQueries({
          queryKey: clientKeys.activities(variables.clientId),
        });
        queryClient.invalidateQueries({
          queryKey: clientKeys.detail(variables.clientId),
        });
      }
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Mutation to update an existing calendar activity
 */
export function useUpdateCalendarEntry() {
  const queryClient = useQueryClient();

  return useMutation<
    CalendarEntry,
    Error,
    { id: string; data: UpdateCalendarEntryInput }
  >({
    mutationFn: ({ id, data }) => calendarService.updateEntry(id, data),
    onSuccess: (entry, variables) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      queryClient.invalidateQueries({
        queryKey: calendarKeys.detail(variables.id),
      });

      if (entry.clientId) {
        queryClient.invalidateQueries({
          queryKey: clientKeys.activities(entry.clientId),
        });
        queryClient.invalidateQueries({
          queryKey: clientKeys.detail(entry.clientId),
        });
      }
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Mutation to delete a calendar entry
 */
export function useDeleteCalendarEntry() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; clientId?: string }>({
    mutationFn: ({ id }) => calendarService.deleteEntry(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      queryClient.invalidateQueries({
        queryKey: calendarKeys.detail(variables.id),
      });

      if (variables.clientId) {
        queryClient.invalidateQueries({
          queryKey: clientKeys.activities(variables.clientId),
        });
        queryClient.invalidateQueries({
          queryKey: clientKeys.detail(variables.clientId),
        });
      }
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
