import { z } from "zod";

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
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
});

export const linkUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
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

export const clientHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().trim().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientQueryInput = z.infer<typeof clientQuerySchema>;
export type LinkUserInput = z.infer<typeof linkUserSchema>;
export type AssignPortalInput = z.infer<typeof assignPortalSchema>;
export type UpdateClientStatusInput = z.infer<typeof updateClientStatusSchema>;
export type ClientHistoryQueryInput = z.infer<typeof clientHistoryQuerySchema>;
