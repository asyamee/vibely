import axios from "axios";
import type { Pool } from "pg";
import { upsertUserEmbedding } from "../db/postgres.js";
import { logger } from "../lib/logger.js";
import { aiEmbeddingResponseSchema } from "../schemas/external.schema.js";

export async function computeAndSaveEmbedding(pool: Pool, userId: string): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT ue.track_id, ue.genre_id, ue.artist_ids, ue.rating
       FROM user_events ue WHERE ue.user_id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      logger.info({ userId }, "computeAndSaveEmbedding: no events, skipping");
      return;
    }

    const tracks = result.rows.map((r: { track_id: number; genre_id: number; artist_ids: number[]; rating: number }) => ({
      id: r.track_id,
      genre_id: r.genre_id,
      artist_ids: r.artist_ids,
      rating: r.rating,
    }));

    const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const response = await axios.post(
      `${aiUrl}/compute-embedding`,
      { user_id: userId, tracks },
      { timeout: 15_000 },
    );
    const parsed = aiEmbeddingResponseSchema.parse(response.data);
    const embedding: number[] = parsed.embedding;
    await upsertUserEmbedding(pool, userId, embedding);
    logger.info({ userId, embeddingDim: embedding.length }, "computeAndSaveEmbedding: saved");
  } catch (err) {
    logger.error({ userId, err }, "computeAndSaveEmbedding: failed");
    throw err;
  }
}
