import { z } from "zod";
import type {
  PaymentMethod,
  PaymentType,
  PaymentStatus,
} from "@/types/models";
import type { PaginationMeta } from "@/types/api.types";

export const paymentTypeEnum = z.enum(["ADVANCE", "PARTIAL", "FULL", "OTHER"]);
export const paymentMethodEnum = z.enum([
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CARD",
  "CHEQUE",
  "OTHER",
]);
export const paymentStatusEnum = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
]);

export const paymentAllocationInputSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID format"),
  amount: z.coerce.number().positive("Allocation amount must be greater than 0"),
});

export const createPaymentSchema = z.object({
  clientId: z.string().uuid("Invalid client ID format"),
  eventId: z.string().uuid("Invalid event ID format").optional().nullable(),
  proformaInvoiceId: z.string().uuid("Invalid proforma invoice ID format").optional().nullable(),
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  paymentType: paymentTypeEnum.default("OTHER"),
  paymentMethod: paymentMethodEnum,
  paymentDate: z.union([z.string().min(1, "Valid paymentDate is required"), z.date()]),
  transactionReference: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  allocations: z.array(paymentAllocationInputSchema).optional().default([]),
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  clientId: z.string().uuid("Invalid client ID format").optional(),
  eventId: z.string().uuid("Invalid event ID format").optional(),
  paymentType: paymentTypeEnum.optional(),
  paymentMethod: paymentMethodEnum.optional(),
  status: paymentStatusEnum.optional(),
  search: z.string().trim().optional(),
  from: z.union([z.string(), z.date()]).optional(),
  to: z.union([z.string(), z.date()]).optional(),
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

export interface PaymentAllocationItem {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number | string;
  allocatedAt: string | Date;
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number | string;
    status: string;
  };
}

export interface PaymentItem {
  id: string;
  paymentNumber: string;
  clientId: string;
  eventId?: string | null;
  proformaInvoiceId?: string | null;
  amount: number | string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string | null;
  paymentDate: string | Date;
  notes?: string | null;
  recordedById: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  client?: {
    id: string;
    name: string;
    email?: string | null;
    phone: string;
    address?: string | null;
    city?: string | null;
  };
  event?: {
    id: string;
    eventNumber: string;
    title: string;
    status?: string;
    eventDate?: string | Date;
  } | null;
  recordedBy?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  };
  allocations?: PaymentAllocationItem[];
  proformaInvoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number | string;
  } | null;
}

export type PaymentDetail = PaymentItem;

export interface PaymentListResponse {
  payments: PaymentItem[];
  meta?: PaginationMeta;
}

export interface ClientPendingInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  eventId?: string | null;
  title: string;
  invoiceDate: string | Date;
  dueDate?: string | Date | null;
  totalAmount: number | string;
  paidAmount: number | string;
  balanceAmount: number | string;
  status: string;
  event?: {
    id: string;
    eventNumber: string;
    title: string;
  } | null;
}
