import { z } from "zod";
import { InvoiceStatus, InvoiceType, DiscountType } from "../generated/prisma/enums.js";

export const invoiceItemInputSchema = z.object({
  id: z.string().uuid("Invalid item ID format").optional(),
  itemName: z.string().trim().min(1, "Item name is required").max(255),
  description: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().trim().max(50).optional().nullable(),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  sortOrder: z.coerce.number().int().default(0),
  type: z.nativeEnum(InvoiceType, {
    message: "Valid invoice item type is required (PROFORMA or FINAL)",
  }),
  quotationId: z.string().uuid("Invalid quotation ID format").optional().nullable(),
  advanceAdjusted: z.coerce.number().min(0, "advanceAdjusted cannot be negative").default(0),
});

export const createInvoiceSchema = z
  .object({
    clientId: z.string().uuid("Invalid client ID format"),
    eventId: z.string().uuid("Invalid event ID format").optional().nullable(),
    title: z.string().trim().min(2, "Invoice title must be at least 2 characters").max(255),
    invoiceDate: z.coerce.date({ message: "Valid invoiceDate is required" }),
    dueDate: z.coerce.date().optional().nullable(),
    discountType: z.nativeEnum(DiscountType).optional().nullable(),
    discountValue: z.coerce.number().min(0, "discountValue cannot be negative").default(0),
    taxRate: z.coerce.number().min(0, "taxRate cannot be negative").max(100, "taxRate cannot exceed 100%").default(0),
    notes: z.string().trim().optional().nullable(),
    terms: z.string().trim().optional().nullable(),
    items: z.array(invoiceItemInputSchema).min(1, "Invoice must contain at least one line item"),
  })
  .refine(
    (data) => {
      if (data.dueDate && data.invoiceDate && data.dueDate < data.invoiceDate) {
        return false;
      }
      return true;
    },
    {
      message: "dueDate cannot be earlier than invoiceDate",
      path: ["dueDate"],
    }
  );

export const updateInvoiceSchema = z
  .object({
    title: z.string().trim().min(2, "Invoice title must be at least 2 characters").max(255).optional(),
    invoiceDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional().nullable(),
    discountType: z.nativeEnum(DiscountType).optional().nullable(),
    discountValue: z.coerce.number().min(0, "discountValue cannot be negative").optional(),
    taxRate: z.coerce.number().min(0, "taxRate cannot be negative").max(100, "taxRate cannot exceed 100%").optional(),
    notes: z.string().trim().optional().nullable(),
    terms: z.string().trim().optional().nullable(),
    items: z.array(invoiceItemInputSchema).min(1, "Invoice must contain at least one line item").optional(),
  })
  .refine(
    (data) => {
      if (data.dueDate && data.invoiceDate && data.dueDate < data.invoiceDate) {
        return false;
      }
      return true;
    },
    {
      message: "dueDate cannot be earlier than invoiceDate",
      path: ["dueDate"],
    }
  );

export const updateInvoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus, {
    message: "Valid status is required (DRAFT, SENT, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED)",
  }),
  notes: z.string().trim().optional().nullable(),
});

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(InvoiceStatus).optional(),
  clientId: z.string().uuid("Invalid client ID format").optional(),
  eventId: z.string().uuid("Invalid event ID format").optional(),
  search: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
