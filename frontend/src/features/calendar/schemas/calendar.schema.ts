import { z } from "zod";
import type { CalendarEntry } from "@/types/models";
import type { PaginationMeta } from "@/types/api.types";

/**
 * Calendar Entry Types supported by Backend Prisma Enum & EMS Operations
 */
export const calendarEntryTypeEnum = z.enum([
  "MEETING",
  "SITE_VISIT",
  "VENDOR_MEETING",
  "OFFICE_ACTIVITY",
  "OTHER",
]);

export type CalendarEntryType = z.infer<typeof calendarEntryTypeEnum>;

export const CALENDAR_ENTRY_TYPES: CalendarEntryType[] = [
  "MEETING",
  "SITE_VISIT",
  "VENDOR_MEETING",
  "OFFICE_ACTIVITY",
  "OTHER",
];

export const CALENDAR_ENTRY_TYPE_LABELS: Record<CalendarEntryType, string> = {
  MEETING: "Client Meeting",
  SITE_VISIT: "Site Visit",
  VENDOR_MEETING: "Vendor Meeting",
  OFFICE_ACTIVITY: "Office Activity",
  OTHER: "General Activity",
};

export const CALENDAR_ENTRY_TYPE_COLORS: Record<
  CalendarEntryType,
  {
    bg: string;
    text: string;
    border: string;
    badgeVariant: "default" | "secondary" | "outline" | "destructive";
    dotColor: string;
  }
> = {
  MEETING: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    badgeVariant: "secondary",
    dotColor: "bg-blue-500",
  },
  SITE_VISIT: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    badgeVariant: "secondary",
    dotColor: "bg-emerald-500",
  },
  VENDOR_MEETING: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
    badgeVariant: "secondary",
    dotColor: "bg-amber-500",
  },
  OFFICE_ACTIVITY: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
    badgeVariant: "secondary",
    dotColor: "bg-purple-500",
  },
  OTHER: {
    bg: "bg-zinc-500/10 dark:bg-zinc-500/20",
    text: "text-zinc-700 dark:text-zinc-300",
    border: "border-zinc-500/30",
    badgeVariant: "outline",
    dotColor: "bg-zinc-500",
  },
};

/**
 * Create Calendar Entry Schema
 * Mirrors backend/src/validations/calendar.validation.ts
 */
export const createCalendarEntrySchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters"),
    description: z.string().trim().optional(),
    type: calendarEntryTypeEnum,
    startAt: z.date({ message: "Valid start date and time is required" }),
    endAt: z.date({ message: "Invalid end date and time" }).optional(),
    allDay: z.boolean(),
    location: z.string().trim().optional(),
    clientId: z.string().min(1, "Please select a client"),
    eventId: z
      .string()
      .trim()
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.endAt && data.startAt && data.endAt < data.startAt) {
        return false;
      }
      return true;
    },
    {
      message: "End time cannot be earlier than start time",
      path: ["endAt"],
    }
  );

/**
 * Update Calendar Entry Schema
 * Mirrors backend/src/validations/calendar.validation.ts
 */
export const updateCalendarEntrySchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters").optional(),
    description: z.string().trim().optional().nullable().or(z.literal("")),
    type: calendarEntryTypeEnum.optional(),
    startAt: z.coerce.date().optional(),
    endAt: z
      .preprocess(
        (val) => (val === "" || val === null || val === undefined ? undefined : val),
        z.coerce.date().optional().nullable()
      )
      .optional(),
    allDay: z.boolean().optional(),
    location: z.string().trim().optional().nullable().or(z.literal("")),
    clientId: z.string().optional(),
    eventId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.endAt && data.startAt && new Date(data.endAt) < new Date(data.startAt)) {
        return false;
      }
      return true;
    },
    {
      message: "End time cannot be earlier than start time",
      path: ["endAt"],
    }
  );

/**
 * Query schema for listing calendar entries
 */
export const calendarQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50).optional(),
  from: z.string().or(z.date()).optional(),
  to: z.string().or(z.date()).optional(),
  type: calendarEntryTypeEnum.optional(),
  clientId: z.string().optional(),
  eventId: z.string().optional(),
  search: z.string().trim().optional(),
});

export type CreateCalendarEntryInput = z.infer<typeof createCalendarEntrySchema>;
export type UpdateCalendarEntryInput = z.infer<typeof updateCalendarEntrySchema>;
export type CalendarQueryParams = z.infer<typeof calendarQuerySchema>;
export type CalendarQueryInput = CalendarQueryParams;

export interface CalendarListResponse {
  entries: CalendarEntry[];
  meta?: PaginationMeta;
}
