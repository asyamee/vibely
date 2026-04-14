import type { Request, Response } from "express";
import {
  getAllUserEmbeddingsExcept,
  getPool,
  getUserEmbedding,
} from "../db/postgres.js";

type Neighbor = {
  userId: string;
  similarity: number;
};

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

export const getSimilarUsers = (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const topK = Math.min(
    100,
    Math.max(1, Number.parseInt((req.query.top_k as string) ?? "10", 10)),
  );

  const pool = getPool();

  (async () => {
    try {
      const target = await getUserEmbedding(pool, userId);
      if (!target) {
        return res.status(404).json({ message: "user embedding not found" });
      }

      const all = await getAllUserEmbeddingsExcept(pool, userId);
      const neighbors: Neighbor[] = all.map((row) => ({
        userId: row.user_id,
        similarity: cosineSimilarity(target, row.embedding),
      }));

      neighbors.sort((a, b) => b.similarity - a.similarity);

      return res.status(200).json({
        userId,
        neighbors: neighbors.slice(0, topK),
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Ошибка поиска похожих пользователей" });
    }
  })().catch((err) => {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Ошибка поиска похожих пользователей" });
  });
};

