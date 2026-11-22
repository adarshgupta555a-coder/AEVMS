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

export const activatePortalSchema = z
  .object({
    token: z.string().trim().min(1, "Activation token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ActivatePortalInput = z.infer<typeof activatePortalSchema>;
