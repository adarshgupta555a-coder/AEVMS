import { z } from "zod";
import type { Quotation, QuotationItem, Client, User, Event } from "@/types/models";

// ==========================================
// STRING UNION CONSTANTS / ENUMS
// ==========================================

export const QUOTATION_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;

export type QuotationStatusType = (typeof QUOTATION_STATUSES)[number];
export type DiscountTypeEnum = (typeof DISCOUNT_TYPES)[number];

// ==========================================
// ZOD VALIDATION SCHEMAS (MIRRORS BACKEND)
// ==========================================

export const quotationItemInputSchema = z.object({
  id: z.string().uuid("Invalid item ID format").optional(),
  itemName: z.string().trim().min(1, "Item name is required").max(255),
  description: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().trim().max(50).optional().nullable(),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  sortOrder: z.coerce.number().int().default(0),
});

export const createQuotationSchema = z.object({
  clientId: z.string().uuid("Please select a valid client"),
  title: z.string().trim().min(2, "Quotation title must be at least 2 characters").max(255),
  eventType: z.string().trim().min(1, "Event type is required").max(100),
  eventDate: z.coerce.date().optional().nullable(),
  venue: z.string().trim().max(255).optional().nullable(),
  guestCount: z.coerce.number().int().positive("Guest count must be positive").optional().nullable(),
  discountType: z.enum(DISCOUNT_TYPES).optional().nullable(),
  discountValue: z.coerce.number().min(0, "Discount value cannot be negative").default(0),
  taxRate: z.coerce.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%").default(0),
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  terms: z.string().trim().optional().nullable(),
  items: z.array(quotationItemInputSchema).min(1, "Quotation must contain at least one item"),
});

export const updateQuotationSchema = z.object({
  title: z.string().trim().min(2, "Quotation title must be at least 2 characters").max(255).optional(),
  eventType: z.string().trim().min(1, "Event type is required").max(100).optional(),
  eventDate: z.coerce.date().optional().nullable(),
  venue: z.string().trim().max(255).optional().nullable(),
  guestCount: z.coerce.number().int().positive("Guest count must be positive").optional().nullable(),
  discountType: z.enum(DISCOUNT_TYPES).optional().nullable(),
  discountValue: z.coerce.number().min(0, "Discount value cannot be negative").optional(),
  taxRate: z.coerce.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%").optional(),
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  terms: z.string().trim().optional().nullable(),
  items: z.array(quotationItemInputSchema).min(1, "Quotation must contain at least one item").optional(),
});

export const updateQuotationStatusSchema = z.object({
  status: z.enum(QUOTATION_STATUSES, {
    message: "Valid status is required (DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, CANCELLED)",
  }),
  notes: z.string().trim().optional().nullable(),
});

export const quotationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  status: z.enum(QUOTATION_STATUSES).optional(),
  clientId: z.string().uuid("Invalid client ID format").optional(),
  search: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const convertToEventSchema = z
  .object({
    title: z.string().trim().min(3, "Event title must be at least 3 characters").optional(),
    eventType: z.string().trim().min(1, "Event type is required").optional(),
    eventDate: z.coerce.date().optional(),
    startTime: z.coerce.date().optional().nullable(),
    endTime: z.coerce.date().optional().nullable(),
    venueName: z.string().trim().optional().nullable(),
    venueAddress: z.string().trim().optional().nullable(),
    guestCount: z.coerce.number().int().positive().optional().nullable(),
    budget: z.coerce.number().min(0).optional().nullable(),
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

// ==========================================
// INFERRED TYPES
// ==========================================

export type QuotationItemInput = z.infer<typeof quotationItemInputSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type UpdateQuotationStatusInput = z.infer<typeof updateQuotationStatusSchema>;
export type QuotationQueryInput = z.infer<typeof quotationQuerySchema>;
export type ConvertToEventInput = z.infer<typeof convertToEventSchema>;

// ==========================================
// DOMAIN / API RESPONSE TYPES
// ==========================================

export interface QuotationWithRelations extends Quotation {
  client?: Client;
  createdBy?: User;
  items?: QuotationItem[];
  event?: Array<Pick<Event, "id" | "eventNumber" | "status" | "title" | "eventDate">>;
}

export interface ConvertToEventResponse {
  quotation: Quotation;
  event: Event;
}
