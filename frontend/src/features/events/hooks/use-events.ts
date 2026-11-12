"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  eventService,
  type EventListResponse,
} from "../services/event.service";
import type {
  EventQueryInput,
  CreateEventInput,
  UpdateEventInput,
  UpdateEventStatusInput,
  CreateEventTaskInput,
  UpdateEventTaskInput,
  CreateEventScheduleInput,
  UpdateEventScheduleInput,
  EventItem,
  EventDetail,
  EventTaskItem,
  EventScheduleItem,
  EventFinancialSummaryResponse,
} from "../schemas/event.schema";

/**
 * Query Key Factory for Event domain
 */
export const eventKeys = {
  all: ["events"] as const,
  lists: () => [...eventKeys.all, "list"] as const,
  list: (params?: EventQueryInput) => [...eventKeys.lists(), params] as const,
  details: () => [...eventKeys.all, "detail"] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
  summary: (id: string) => [...eventKeys.detail(id), "summary"] as const,
  tasks: (eventId: string) => [...eventKeys.detail(eventId), "tasks"] as const,
  schedules: (eventId: string) =>
    [...eventKeys.detail(eventId), "schedules"] as const,
};

/**
 * Hook to retrieve paginated list of events
 */
export function useEvents(params?: EventQueryInput) {
  return useQuery<EventListResponse, Error>({
    queryKey: eventKeys.list(params),
    queryFn: () => eventService.getEvents(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve single event details by ID
 */
export function useEvent(id: string) {
  return useQuery<EventDetail, Error>({
    queryKey: eventKeys.detail(id),
    queryFn: () => eventService.getEventById(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve event financial summary
 */
export function useEventSummary(id: string) {
  return useQuery<EventFinancialSummaryResponse, Error>({
    queryKey: eventKeys.summary(id),
    queryFn: () => eventService.getEventSummary(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve operational tasks for an event
 */
export function useEventTasks(eventId: string) {
  return useQuery<EventTaskItem[], Error>({
    queryKey: eventKeys.tasks(eventId),
    queryFn: () => eventService.getTasks(eventId),
    enabled: Boolean(eventId),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to retrieve operational schedules for an event
 */
export function useEventSchedules(eventId: string) {
  return useQuery<EventScheduleItem[], Error>({
    queryKey: eventKeys.schedules(eventId),
    queryFn: () => eventService.getSchedules(eventId),
    enabled: Boolean(eventId),
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation to create a new event
 */
export function useCreateEventMutation() {
  const queryClient = useQueryClient();

  return useMutation<EventItem, Error, CreateEventInput>({
    mutationFn: (data: CreateEventInput) => eventService.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

/**
 * Mutation to update an event
 */
export function useUpdateEventMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    EventItem,
    Error,
    { id: string; data: UpdateEventInput }
  >({
    mutationFn: ({ id, data }) => eventService.updateEvent(id, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.summary(id) });
    },
  });
}

/**
 * Mutation to transition event status
 */
export function useUpdateEventStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    EventItem,
    Error,
    { id: string; data: UpdateEventStatusInput }
  >({
    mutationFn: ({ id, data }) => eventService.updateEventStatus(id, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.summary(id) });
    },
  });
}

/**
 * Mutation to delete an event
 */
export function useDeleteEventMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id: string) => eventService.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

/**
 * Task Mutations
 */
export function useCreateTaskMutation(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation<EventTaskItem, Error, CreateEventTaskInput>({
    mutationFn: (data: CreateEventTaskInput) =>
      eventService.createTask(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.tasks(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.summary(eventId) });
    },
  });
}

export function useUpdateTaskMutation(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    EventTaskItem,
    Error,
    { taskId: string; data: UpdateEventTaskInput }
  >({
    mutationFn: ({ taskId, data }) => eventService.updateTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.tasks(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.summary(eventId) });
    },
  });
}

export function useDeleteTaskMutation(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (taskId: string) => eventService.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.tasks(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.summary(eventId) });
    },
  });
}

/**
 * Schedule Mutations
 */
export function useCreateScheduleMutation(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation<EventScheduleItem, Error, CreateEventScheduleInput>({
    mutationFn: (data: CreateEventScheduleInput) =>
      eventService.createSchedule(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: eventKeys.schedules(eventId),
      });
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.summary(eventId) });
    },
  });
}

export function useUpdateScheduleMutation(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    EventScheduleItem,
    Error,
    { scheduleId: string; data: UpdateEventScheduleInput }
  >({
    mutationFn: ({ scheduleId, data }) =>
      eventService.updateSchedule(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: eventKeys.schedules(eventId),
      });
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.summary(eventId) });
    },
  });
}

export function useDeleteScheduleMutation(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (scheduleId: string) =>
      eventService.deleteSchedule(scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: eventKeys.schedules(eventId),
      });
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.summary(eventId) });
    },
  });
}
