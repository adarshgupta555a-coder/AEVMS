import { apiClient } from "@/lib/api";
import type { CalendarEntry } from "@/types/models";
import type {
  CreateCalendarEntryInput,
  UpdateCalendarEntryInput,
  CalendarQueryParams,
  CalendarListResponse,
} from "../schemas/calendar.schema";

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

export const calendarService = {
  /**
   * Fetch calendar entries / activities with optional filters
   */
  async getEntries(params?: CalendarQueryParams): Promise<CalendarListResponse> {
    const qs = buildQueryString(params as Record<string, unknown>);
    const res = await apiClient<CalendarEntry[]>(`/calendar${qs}`, {
      method: "GET",
    });

    return {
      entries: res.data ?? [],
      meta: res.meta,
    };
  },

  /**
   * Fetch single calendar activity entry by ID
   */
  async getEntryById(id: string): Promise<CalendarEntry> {
    const res = await apiClient<CalendarEntry>(`/calendar/${id}`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(res.message || `Calendar entry ${id} not found`);
    }

    return res.data;
  },

  /**
   * Create a new calendar entry / activity
   */
  async createEntry(data: CreateCalendarEntryInput): Promise<CalendarEntry> {
    const payload = {
      ...data,
      startAt:
        data.startAt instanceof Date ? data.startAt.toISOString() : new Date(data.startAt).toISOString(),
      endAt: data.endAt
        ? data.endAt instanceof Date
          ? data.endAt.toISOString()
          : new Date(data.endAt).toISOString()
        : null,
      eventId: data.eventId && data.eventId.trim() !== "" ? data.eventId : null,
      description: data.description && data.description.trim() !== "" ? data.description.trim() : null,
      location: data.location && data.location.trim() !== "" ? data.location.trim() : null,
    };

    const res = await apiClient<CalendarEntry>("/calendar", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to create calendar entry");
    }

    return res.data;
  },

  /**
   * Update an existing calendar entry
   */
  async updateEntry(
    id: string,
    data: UpdateCalendarEntryInput
  ): Promise<CalendarEntry> {
    const payload: Record<string, unknown> = { ...data };

    if (data.startAt) {
      payload.startAt =
        data.startAt instanceof Date
          ? data.startAt.toISOString()
          : new Date(data.startAt).toISOString();
    }
    if (data.endAt !== undefined) {
      payload.endAt = data.endAt
        ? data.endAt instanceof Date
          ? data.endAt.toISOString()
          : new Date(data.endAt).toISOString()
        : null;
    }
    if (data.eventId !== undefined) {
      payload.eventId = data.eventId && data.eventId.trim() !== "" ? data.eventId : null;
    }
    if (data.description !== undefined) {
      payload.description =
        data.description && data.description.trim() !== "" ? data.description.trim() : null;
    }
    if (data.location !== undefined) {
      payload.location =
        data.location && data.location.trim() !== "" ? data.location.trim() : null;
    }

    const res = await apiClient<CalendarEntry>(`/calendar/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to update calendar entry");
    }

    return res.data;
  },

  /**
   * Delete calendar activity entry
   */
  async deleteEntry(id: string): Promise<void> {
    await apiClient(`/calendar/${id}`, {
      method: "DELETE",
    });
  },
};
