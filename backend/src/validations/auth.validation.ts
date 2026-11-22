import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email or username is required"),
  password: z
    .string()
    .min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export const activatePortalSchema = z.object({
  token: z.string().trim().min(1, "Activation token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ActivatePortalInput = z.infer<typeof activatePortalSchema>;
