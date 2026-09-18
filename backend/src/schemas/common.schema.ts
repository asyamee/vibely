import { z } from "zod/v4";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const topKSchema = z.object({
  top_k: z.coerce.number().int().min(1).max(100).default(10),
});

export const countSchema = z.object({
  count: z.coerce.number().int().min(1).max(50).default(10),
});

export type TPagination = z.infer<typeof paginationSchema>;
