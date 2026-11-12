import { z } from "zod";
import type { EventStatus, TaskStatus, TaskPriority } from "@/types/models";
export type { EventStatus, TaskStatus, TaskPriority };

// =============================================================================
// ENUM DEFINITIONS
// =============================================================================

export const eventStatusEnum = z.enum([
  "DRAFT",
  "CONFIRMED",
  "PLANNING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const taskStatusEnum = z.enum([
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "COMPLETED",
  "CANCELLED",
]);

export const taskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// State Machine transitions allowed in backend
export const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PLANNING", "CANCELLED"],
  PLANNING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// =============================================================================
// EVENT VALIDATION SCHEMAS
// =============================================================================

export const createEventSchema = z
  .object({
    clientId: z.string().uuid("Invalid client ID format"),
    quotationId: z
      .string()
      .uuid("Invalid quotation ID format")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    title: z.string().trim().min(3, "Title must be at least 3 characters"),
    eventType: z
      .string()
      .trim()
      .min(2, "Event type is required (e.g. Wedding, Corporate, Birthday)"),
    description: z.string().trim().optional().nullable(),
    eventDate: z.coerce.date({ message: "Valid eventDate is required" }),
    startTime: z.coerce
      .date({ message: "Invalid startTime" })
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    endTime: z.coerce
      .date({ message: "Invalid endTime" })
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    venueName: z.string().trim().optional().nullable(),
    venueAddress: z.string().trim().optional().nullable(),
    guestCount: z.coerce
      .number()
      .int()
      .positive("guestCount must be positive")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    budget: z.coerce
      .number()
      .min(0, "budget cannot be negative")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
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
    startTime: z.coerce
      .date()
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    endTime: z.coerce
      .date()
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    venueName: z.string().trim().optional().nullable(),
    venueAddress: z.string().trim().optional().nullable(),
    guestCount: z.coerce
      .number()
      .int()
      .positive("guestCount must be positive")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    budget: z.coerce
      .number()
      .min(0, "budget cannot be negative")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    notes: z.string().trim().optional().nullable(),
    quotationId: z
      .string()
      .uuid("Invalid quotation ID format")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
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
  status: eventStatusEnum,
  reason: z.string().trim().optional(),
});

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  status: eventStatusEnum.optional(),
  clientId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().optional(),
});

// =============================================================================
// OPERATIONAL TASKS SCHEMAS
// =============================================================================

export const createEventTaskSchema = z.object({
  title: z.string().trim().min(2, "Task title must be at least 2 characters"),
  description: z.string().trim().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: taskPriorityEnum.default("MEDIUM"),
  status: taskStatusEnum.default("TODO"),
});

export const updateEventTaskSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: taskPriorityEnum.optional(),
  status: taskStatusEnum.optional(),
});

// =============================================================================
// OPERATIONAL SCHEDULES SCHEMAS
// =============================================================================

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

// =============================================================================
// INFERRED TYPES & RESPONSE DTOs
// =============================================================================

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreateEventRawInput = z.input<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type UpdateEventRawInput = z.input<typeof updateEventSchema>;
export type UpdateEventStatusInput = z.infer<typeof updateEventStatusSchema>;
export type EventQueryInput = z.infer<typeof eventQuerySchema>;
export type CreateEventTaskInput = z.infer<typeof createEventTaskSchema>;
export type UpdateEventTaskInput = z.infer<typeof updateEventTaskSchema>;
export type CreateEventScheduleInput = z.infer<typeof createEventScheduleSchema>;
export type UpdateEventScheduleInput = z.infer<typeof updateEventScheduleSchema>;

export interface EventItem {
  id: string;
  eventNumber: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
  };
  quotationId?: string | null;
  quotation?: {
    id: string;
    quotationNumber: string;
    totalAmount: number | string;
  } | null;
  title: string;
  eventType: string;
  description?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  guestCount?: number | null;
  budget?: number | string | null;
  status: EventStatus;
  notes?: string | null;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  _count?: {
    tasks: number;
    schedules: number;
    invoice: number;
    payments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EventDetail extends EventItem {
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    city?: string | null;
  };
  quotation?: {
    id: string;
    quotationNumber: string;
    title: string;
    totalAmount: number | string;
    status: string;
  } | null;
  tasks: EventTaskItem[];
  schedules: EventScheduleItem[];
  calendar?: Array<{
    id: string;
    title: string;
    type: string;
    startAt: string;
    endAt?: string | null;
    location?: string | null;
  }>;
}

export interface EventTaskItem {
  id: string;
  eventId: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventScheduleItem {
  id: string;
  eventId: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventFinancialSummaryResponse {
  event: {
    id: string;
    eventNumber: string;
    title: string;
    status: EventStatus;
    eventDate: string;
    client: {
      id: string;
      name: string;
      email: string | null;
    };
  };
  financials: {
    budget: number;
    totalInvoiced: number;
    totalPaid: number;
    totalExpenses: number;
    balanceReceivable: number;
    profitMargin: number;
  };
  counts: {
    tasks: number;
    schedules: number;
    invoice: number;
    payments: number;
    expense: number;
  };
}
