import { z } from "zod/v4";

export const updateProfileSchema = z.object({
  displayName: z.string().optional(),
  genres: z.array(z.string()).optional(),
  telegram: z.string().nullish(),
  phone: z.string().nullish(),
  contactEmail: z.string().email().nullish(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1),
});

export const upsertProfileSchema = z.object({
  displayName: z.string().optional(),
  genres: z.array(z.string()).optional(),
});

export const updateEmbeddingSchema = z.object({
  embedding: z.array(z.number()).min(1),
});

export type TUpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type TChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TDeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type TUpsertProfileInput = z.infer<typeof upsertProfileSchema>;
export type TUpdateEmbeddingInput = z.infer<typeof updateEmbeddingSchema>;
