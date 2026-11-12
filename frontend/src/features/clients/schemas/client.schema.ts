import { z } from "zod";
import type { Client, Event, Quotation, Invoice, Payment } from "@/types/models";

export const createClientSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Phone number must be a valid 10-digit Indian mobile number"),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const updateClientSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Phone number must be a valid 10-digit Indian mobile number")
    .optional(),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const clientQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  search: z.string().trim().optional(),
});

export const assignPortalSchema = z
  .object({
    expiresInHours: z.coerce.number().int().positive().max(168).default(24),
  })
  .default({ expiresInHours: 24 });

export const updateClientStatusSchema = z.object({
  isActive: z.boolean({ message: "isActive is required and must be a boolean" }),
  reason: z.string().trim().optional(),
});

export const clientActivityTypeEnum = z.enum([
  "SITE_VISIT",
  "CLIENT_MEETING",
  "VENDOR_MEETING",
  "REHEARSAL",
  "EVENT_DATE",
  "FOLLOW_UP",
]);

export const createClientActivitySchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters"),
  entryType: clientActivityTypeEnum,
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().optional().or(z.literal("")),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientQueryInput = z.infer<typeof clientQuerySchema>;
export type AssignPortalInput = z.infer<typeof assignPortalSchema>;
export type UpdateClientStatusInput = z.infer<typeof updateClientStatusSchema>;
export type ClientActivityType = z.infer<typeof clientActivityTypeEnum>;
export type CreateClientActivityInput = z.infer<typeof createClientActivitySchema>;

export type PortalState = "NOT_ASSIGNED" | "INVITATION_PENDING" | "INVITATION_EXPIRED" | "ACTIVE";

export interface PortalUserSummary {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  invitationExpiresAt?: string | Date | null;
  createdAt?: string | Date;
}

export interface ClientCounts {
  event: number;
  invoice: number;
  quotations: number;
  payments: number;
}

export interface ClientItem extends Omit<Client, "user"> {
  user?: PortalUserSummary | null;
  _count?: ClientCounts;
}

export interface ClientDetail extends ClientItem {
  event?: Event[];
  invoice?: Invoice[];
  payments?: Payment[];
  quotations?: Quotation[];
}

export interface PortalStatusResponse {
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  status: PortalState;
  canAssign?: boolean;
  canResend?: boolean;
  message?: string;
  user?: PortalUserSummary | null;
}

export interface AssignPortalResponse {
  client?: {
    id: string;
    name: string;
    email: string | null;
  };
  clientId?: string;
  user: PortalUserSummary;
  portalStatus: "INVITATION_PENDING";
  invitationToken: string;
  invitationExpiresAt: string | Date;
  activationUrl: string;
}

export interface UpdateClientStatusResponse {
  id: string;
  name: string;
  email?: string | null;
  isActive: boolean;
  portalActive: boolean;
  hasPortalAccount: boolean;
  user?: PortalUserSummary | null;
  message?: string;
}
