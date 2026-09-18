import { z } from "zod/v4";

export const startRetrainSchema = z.object({
  with_export: z.boolean().default(false),
  epochs: z.number().int().min(1).default(50),
  diversity_weight: z.number().min(0).max(1).default(0.1),
});

export type TStartRetrainInput = z.infer<typeof startRetrainSchema>;
