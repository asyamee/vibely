import { z } from "zod/v4";

export const aiEmbeddingResponseSchema = z
  .object({
    embedding: z.array(z.number()),
  })
  .passthrough();

export const aiStatsResponseSchema = z
  .object({
    status: z.string(),
    num_users: z.number(),
    model_loaded: z.boolean(),
  })
  .passthrough();

export type TAiEmbeddingResponse = z.infer<typeof aiEmbeddingResponseSchema>;
export type TAiStatsResponse = z.infer<typeof aiStatsResponseSchema>;
