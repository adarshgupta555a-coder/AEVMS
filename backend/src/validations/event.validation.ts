import { z } from "zod";
import { EventStatus, TaskStatus, TaskPriority } from "../generated/prisma/enums.js";

export const createEventSchema = z
  .object({
    clientId: z.string().uuid("Invalid client ID format"),
    quotationId: z.string().uuid("Invalid quotation ID format").optional().nullable(),
    title: z.string().trim().min(3, "Title must be at least 3 characters"),
    eventType: z.string().trim().min(2, "Event type is required (e.g. Wedding, Corporate, Birthday)"),
    description: z.string().trim().optional().nullable(),
    eventDate: z.coerce.date({ message: "Valid eventDate is required" }),
    startTime: z.coerce.date({ message: "Invalid startTime" }).optional().nullable(),
    endTime: z.coerce.date({ message: "Invalid endTime" }).optional().nullable(),
    venueName: z.string().trim().optional().nullable(),
    venueAddress: z.string().trim().optional().nullable(),
    guestCount: z.coerce.number().int().positive("guestCount must be positive").optional().nullable(),
    budget: z.coerce.number().min(0, "budget cannot be negative").optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime && data.endTime < data.startTime) {
        return false;
      }
      return true;
    },
    {
      message: "endTime cannot be earlier than startTime",
      path: ["endTime"],
    }
  );

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").optional(),
    eventType: z.string().trim().min(2).optional(),
    description: z.string().trim().optional().nullable(),
    eventDate: z.coerce.date().optional(),
    startTime: z.coerce.date().optional().nullable(),
    endTime: z.coerce.date().optional().nullable(),
    venueName: z.string().trim().optional().nullable(),
    venueAddress: z.string().trim().optional().nullable(),
    guestCount: z.coerce.number().int().positive().optional().nullable(),
    budget: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    quotationId: z.string().uuid().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime && data.endTime < data.startTime) {
        return false;
      }
      return true;
    },
    {
      message: "endTime cannot be earlier than startTime",
      path: ["endTime"],
    }
  );

export const updateEventStatusSchema = z.object({
  status: z.nativeEnum(EventStatus, {
    message: "Valid status is required (DRAFT, CONFIRMED, PLANNING, IN_PROGRESS, COMPLETED, CANCELLED)",
  }),
  reason: z.string().trim().optional(),
});

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(EventStatus).optional(),
  clientId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().optional(),
});

// Operational Tasks
export const createEventTaskSchema = z.object({
  title: z.string().trim().min(2, "Task title must be at least 2 characters"),
  description: z.string().trim().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
});

export const updateEventTaskSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
});

export const updateEventTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus, {
    message: "Valid task status is required (TODO, IN_PROGRESS, COMPLETED, CANCELLED)",
  }),
});

// Operational Schedules
export const createEventScheduleSchema = z
  .object({
    title: z.string().trim().min(2, "Schedule title must be at least 2 characters"),
    description: z.string().trim().optional().nullable(),
    startAt: z.coerce.date({ message: "Valid startAt is required" }),
    endAt: z.coerce.date().optional().nullable(),
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

export const updateEventScheduleSchema = z
  .object({
    title: z.string().trim().min(2).optional(),
    description: z.string().trim().optional().nullable(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional().nullable(),
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

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type UpdateEventStatusInput = z.infer<typeof updateEventStatusSchema>;
export type EventQueryInput = z.infer<typeof eventQuerySchema>;
export type CreateEventTaskInput = z.infer<typeof createEventTaskSchema>;
export type UpdateEventTaskInput = z.infer<typeof updateEventTaskSchema>;
export type CreateEventScheduleInput = z.infer<typeof createEventScheduleSchema>;
export type UpdateEventScheduleInput = z.infer<typeof updateEventScheduleSchema>;
