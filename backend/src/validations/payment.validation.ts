import { z } from "zod";
import { PaymentMethod, PaymentType, PaymentStatus } from "../generated/prisma/enums.js";

export const paymentAllocationInputSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID format"),
  amount: z.coerce.number().positive("Allocation amount must be greater than 0"),
});

export const createPaymentSchema = z.object({
  clientId: z.string().uuid("Invalid client ID format"),
  eventId: z.string().uuid("Invalid event ID format").optional().nullable(),
  proformaInvoiceId: z.string().uuid("Invalid proforma invoice ID format").optional().nullable(),
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  paymentType: z.nativeEnum(PaymentType).default(PaymentType.OTHER),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    message: "Valid paymentMethod is required (CASH, UPI, BANK_TRANSFER, CARD, CHEQUE, OTHER)",
  }),
  paymentDate: z.coerce.date({ message: "Valid paymentDate is required" }),
  transactionReference: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  allocations: z.array(paymentAllocationInputSchema).optional().default([]),
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  clientId: z.string().uuid("Invalid client ID format").optional(),
  eventId: z.string().uuid("Invalid event ID format").optional(),
  paymentType: z.nativeEnum(PaymentType).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  search: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const createRazorpayOrderSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID format"),
  amount: z.coerce.number().positive("Payment amount must be greater than 0").optional(),
});

export const verifyRazorpayPaymentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID format"),
  razorpayOrderId: z.string().min(1, "razorpayOrderId is required"),
  razorpayPaymentId: z.string().min(1, "razorpayPaymentId is required"),
  razorpaySignature: z.string().min(1, "razorpaySignature is required"),
});

export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
export type CreateRazorpayOrderInput = z.infer<typeof createRazorpayOrderSchema>;
export type VerifyRazorpayPaymentInput = z.infer<typeof verifyRazorpayPaymentSchema>;
