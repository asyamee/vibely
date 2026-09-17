import { z } from "zod/v4";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type TRegisterInput = z.infer<typeof registerSchema>;
export type TLoginInput = z.infer<typeof loginSchema>;
