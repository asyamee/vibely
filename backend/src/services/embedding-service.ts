import axios from "axios";
import type { Pool } from "pg";
import { upsertUserEmbedding } from "../db/postgres.js";

export async function computeAndSaveEmbedding(pool: Pool, userId: string): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT ue.track_id, ue.genre_id, ue.artist_ids, ue.rating
       FROM user_events ue WHERE ue.user_id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      console.log(`No events for user ${userId}, skipping embedding`);
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
    const embedding: number[] = response.data.embedding;
    await upsertUserEmbedding(pool, userId, embedding);
    console.log(`Embedding saved for user ${userId}`);
  } catch (err) {
    console.error(`Failed to compute embedding for ${userId}:`, err);
    throw err;
  }
}
