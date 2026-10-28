import { z } from "zod";

// Frappe's /api/method/login accepts an email, a username (e.g. "Administrator")
// or a mobile number as `usr` — so this must not be an email-only check.
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
