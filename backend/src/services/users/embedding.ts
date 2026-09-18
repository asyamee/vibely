import { getPool, upsertUserEmbedding } from "../../db/postgres.js";
import { logger } from "../../lib/logger.js";

export async function updateEmbedding(
  userId: string,
  embedding: number[],
): Promise<{ embeddingDim: number }> {
  const pool = getPool();
  await upsertUserEmbedding(pool, userId, embedding);

  logger.debug({ userId, embeddingDim: embedding.length }, "updateEmbedding: saved");

  return { embeddingDim: embedding.length };
}
