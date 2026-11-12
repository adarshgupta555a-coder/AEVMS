import { z } from "zod";
import { QuotationStatus, DiscountType } from "../generated/prisma/enums.js";

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
  clientId: z.string().uuid("Invalid client ID format"),
  title: z.string().trim().min(2, "Quotation title must be at least 2 characters").max(255),
  eventType: z.string().trim().min(1, "Event type is required").max(100),
  eventDate: z.coerce.date().optional().nullable(),
  venue: z.string().trim().max(255).optional().nullable(),
  guestCount: z.coerce.number().int().positive("guestCount must be positive").optional().nullable(),
  discountType: z.nativeEnum(DiscountType).optional().nullable(),
  discountValue: z.coerce.number().min(0, "discountValue cannot be negative").default(0),
  taxRate: z.coerce.number().min(0, "taxRate cannot be negative").max(100, "taxRate cannot exceed 100%").default(0),
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
  guestCount: z.coerce.number().int().positive("guestCount must be positive").optional().nullable(),
  discountType: z.nativeEnum(DiscountType).optional().nullable(),
  discountValue: z.coerce.number().min(0, "discountValue cannot be negative").optional(),
  taxRate: z.coerce.number().min(0, "taxRate cannot be negative").max(100, "taxRate cannot exceed 100%").optional(),
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  terms: z.string().trim().optional().nullable(),
  items: z.array(quotationItemInputSchema).min(1, "Quotation must contain at least one item").optional(),
});

export const updateQuotationStatusSchema = z.object({
  status: z.nativeEnum(QuotationStatus, {
    message: "Valid status is required (DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, CANCELLED)",
  }),
  notes: z.string().trim().optional().nullable(),
});

export const quotationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(QuotationStatus).optional(),
  clientId: z.string().uuid("Invalid client ID format").optional(),
  search: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const convertToEventSchema = z
  .object({
    title: z.string().trim().min(3, "Event title must be at least 3 characters").optional(),
    eventType: z.string().trim().min(1).optional(),
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

export type QuotationItemInput = z.infer<typeof quotationItemInputSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type UpdateQuotationStatusInput = z.infer<typeof updateQuotationStatusSchema>;
export type QuotationQueryInput = z.infer<typeof quotationQuerySchema>;
export type ConvertToEventInput = z.infer<typeof convertToEventSchema>;
