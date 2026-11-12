import { z } from "zod";
import { CalendarEntryType } from "../generated/prisma/enums.js";

export const createCalendarEntrySchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters"),
    description: z.string().trim().optional(),
    type: z.nativeEnum(CalendarEntryType).default(CalendarEntryType.OTHER),
    startAt: z.coerce.date({ message: "Valid startAt date/time is required" }),
    endAt: z.coerce.date({ message: "Invalid endAt date/time" }).optional(),
    allDay: z.boolean().default(false),
    location: z.string().trim().optional(),
    clientId: z.string().uuid("Invalid client ID format").optional(),
    eventId: z.string().uuid("Invalid event ID format").optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.endAt && data.startAt && data.endAt < data.startAt) {
        return false;
      }
      return true;
    },
    {
      message: "endAt cannot be earlier than startAt",
      path: ["endAt"],
    }
  );

export const updateCalendarEntrySchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters").optional(),
    description: z.string().trim().optional().nullable(),
    type: z.nativeEnum(CalendarEntryType).optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional().nullable(),
    allDay: z.boolean().optional(),
    location: z.string().trim().optional().nullable(),
    eventId: z.string().uuid("Invalid event ID format").optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.endAt && data.startAt && data.endAt < data.startAt) {
        return false;
      }
      return true;
    },
    {
      message: "endAt cannot be earlier than startAt",
      path: ["endAt"],
    }
  );

export const calendarQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.nativeEnum(CalendarEntryType).optional(),
  clientId: z.string().uuid("Invalid client ID format").optional(),
  eventId: z.string().uuid("Invalid event ID format").optional(),
  search: z.string().trim().optional(),
});

export type CreateCalendarEntryInput = z.infer<typeof createCalendarEntrySchema>;
export type UpdateCalendarEntryInput = z.infer<typeof updateCalendarEntrySchema>;
export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;
