import { apiClient } from "@/lib/api";
import type { PaginationMeta } from "@/types/api.types";
import type {
  CreateEventInput,
  UpdateEventInput,
  UpdateEventStatusInput,
  EventQueryInput,
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

export interface EventListResponse {
  events: EventItem[];
  meta?: PaginationMeta;
}

export const eventService = {
  /**
   * Fetch paginated list of events with optional filters (search, status, dates)
   */
  async getEvents(params?: EventQueryInput): Promise<EventListResponse> {
    const qs = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient<EventItem[]>(`/events${qs}`, {
      method: "GET",
    });

    return {
      events: res.data ?? [],
      meta: res.meta,
    };
  },

  /**
   * Fetch complete event details by ID
   */
  async getEventById(id: string): Promise<EventDetail> {
    const res = await apiClient<EventDetail>(`/events/${id}`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(res.message || `Event ${id} not found`);
    }

    return res.data;
  },

  /**
   * Create a new event in DRAFT status
   */
  async createEvent(data: CreateEventInput): Promise<EventItem> {
    const res = await apiClient<EventItem>("/events", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to create event");
    }

    return res.data;
  },

  /**
   * Update event details and budget
   */
  async updateEvent(id: string, data: UpdateEventInput): Promise<EventItem> {
    const res = await apiClient<EventItem>(`/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update event");
    }

    return res.data;
  },

  /**
   * Transition event status with state machine checks
   */
  async updateEventStatus(
    id: string,
    data: UpdateEventStatusInput
  ): Promise<EventItem> {
    const res = await apiClient<EventItem>(`/events/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update event status");
    }

    return res.data;
  },

  /**
   * Delete event
   */
  async deleteEvent(id: string): Promise<void> {
    await apiClient(`/events/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Fetch financial summary (budget, invoiced, paid, expenses, profit margin)
   */
  async getEventSummary(id: string): Promise<EventFinancialSummaryResponse> {
    const res = await apiClient<EventFinancialSummaryResponse>(
      `/events/${id}/summary`,
      {
        method: "GET",
      }
    );

    if (!res.data) {
      throw new Error(res.message || `Failed to fetch summary for event ${id}`);
    }

    return res.data;
  },

  // ===========================================================================
  // OPERATIONAL TASKS
  // ===========================================================================

  /**
   * Get all tasks for an event
   */
  async getTasks(eventId: string): Promise<EventTaskItem[]> {
    const res = await apiClient<EventTaskItem[]>(`/events/${eventId}/tasks`, {
      method: "GET",
    });

    return res.data ?? [];
  },

  /**
   * Create an operational task under an event
   */
  async createTask(
    eventId: string,
    data: CreateEventTaskInput
  ): Promise<EventTaskItem> {
    const res = await apiClient<EventTaskItem>(`/events/${eventId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to create event task");
    }

    return res.data;
  },

  /**
   * Update an operational task
   */
  async updateTask(
    taskId: string,
    data: UpdateEventTaskInput
  ): Promise<EventTaskItem> {
    const res = await apiClient<EventTaskItem>(`/events/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update event task");
    }

    return res.data;
  },

  /**
   * Delete an operational task
   */
  async deleteTask(taskId: string): Promise<void> {
    await apiClient(`/events/tasks/${taskId}`, {
      method: "DELETE",
    });
  },

  // ===========================================================================
  // OPERATIONAL SCHEDULES
  // ===========================================================================

  /**
   * Get all itinerary schedules for an event
   */
  async getSchedules(eventId: string): Promise<EventScheduleItem[]> {
    const res = await apiClient<EventScheduleItem[]>(
      `/events/${eventId}/schedules`,
      {
        method: "GET",
      }
    );

    return res.data ?? [];
  },

  /**
   * Create an itinerary schedule entry for an event
   */
  async createSchedule(
    eventId: string,
    data: CreateEventScheduleInput
  ): Promise<EventScheduleItem> {
    const res = await apiClient<EventScheduleItem>(
      `/events/${eventId}/schedules`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );

    if (!res.data) {
      throw new Error(res.message || "Failed to create event schedule");
    }

    return res.data;
  },

  /**
   * Update an itinerary schedule entry
   */
  async updateSchedule(
    scheduleId: string,
    data: UpdateEventScheduleInput
  ): Promise<EventScheduleItem> {
    const res = await apiClient<EventScheduleItem>(
      `/events/schedules/${scheduleId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );

    if (!res.data) {
      throw new Error(res.message || "Failed to update event schedule");
    }

    return res.data;
  },

  /**
   * Delete an itinerary schedule entry
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    await apiClient(`/events/schedules/${scheduleId}`, {
      method: "DELETE",
    });
  },
};
