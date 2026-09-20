import { getAllUserEmbeddingsExcept, getPool, getUserEmbedding, getUsersBatch } from "../../db/postgres.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";

export interface INeighbor {
  userId: string;
  similarity: number;
  displayName: string;
  avatarUrl: string;
  genres: string[];
  favoriteTracks: { track_id: number; title: string; artist: string }[];
}

export interface ISimilarUsersResult {
  userId: string;
  neighbors: INeighbor[];
}

const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const va = a[i]!;
    const vb = b[i]!;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export async function findSimilarUsers(
  userId: string,
  topK: number,
): Promise<ISimilarUsersResult> {
  const pool = getPool();

  const target = await getUserEmbedding(pool, userId);
  if (!target) {
    throw new AppError("Эмбеддинг пользователя не найден — сначала оцените треки", 404);
  }

  const all = await getAllUserEmbeddingsExcept(pool, userId);
  const neighbors = all.map((row) => ({
    userId: row.user_id,
    similarity: cosineSimilarity(target, row.embedding),
  }));

  neighbors.sort((a, b) => b.similarity - a.similarity);
  const topNeighbors = neighbors.slice(0, topK);

  const profiles = await getUsersBatch(pool, topNeighbors.map((n) => n.userId));
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  const enriched: INeighbor[] = topNeighbors.map((n) => {
    const profile = profileMap.get(n.userId);
    return {
      userId: n.userId,
      similarity: n.similarity,
      displayName: profile?.display_name ?? "Unknown",
      avatarUrl:
        profile?.avatar_url ??
        `https://avatars.yandex.net/get-yapic/${n.userId}/islands-retina-50`,
      genres: profile?.genres ?? [],
      favoriteTracks: profile?.favorite_tracks ?? [],
    };
  });

  logger.debug({ userId, topK, found: enriched.length }, "findSimilarUsers complete");

  return { userId, neighbors: enriched };
}
