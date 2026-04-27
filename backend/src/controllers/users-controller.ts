import type { Request, Response } from "express";
import {
  getPool,
  getUser,
  getUserGenres,
  getUserFavoriteTracks,
  setUserGenres,
  upsertUser,
  upsertUserEmbedding,
} from "../db/postgres.js";

export const getProfile = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const pool = getPool();

    const user = await getUser(pool, userId);
    const genres = await getUserGenres(pool, userId);
    const favoriteTracks = await getUserFavoriteTracks(pool, userId, 5);

    const profile = {
      userId,
      displayName: user?.display_name || null,
      avatarUrl: user?.avatar_url || `https://avatars.yandex.net/get-yapic/${userId}/islands-retina-50`,
      genres,
      favoriteTracks,
    };

    return res.status(200).json(profile);
  } catch (error) {
    console.error("Error getting profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { displayName, genres } = req.body as {
    displayName?: string;
    genres?: string[];
  };

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const pool = getPool();

    await upsertUser(pool, userId, displayName);

    if (genres && Array.isArray(genres)) {
      await setUserGenres(pool, userId, genres);
    }

    const updatedProfile = {
      userId,
      displayName: displayName || null,
      genres: genres || [],
      avatarUrl: `https://avatars.yandex.net/get-yapic/${userId}/islands-retina-50`,
    };

    return res.status(200).json(updatedProfile);
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const upsertUserProfile = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { displayName, genres } = req.body as {
    displayName?: string;
    genres?: string[];
  };

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const pool = getPool();

    await upsertUser(pool, userId, displayName);

    if (genres && Array.isArray(genres)) {
      await setUserGenres(pool, userId, genres);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error upserting user profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Вызывается из AI-скрипта переобучения (retrain.py) для обновления embeddings всех пользователей
export const updateUserEmbedding = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { embedding } = req.body as { embedding?: number[] };

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  if (!Array.isArray(embedding) || embedding.length === 0) {
    return res.status(400).json({ message: "embedding array is required" });
  }

  try {
    const pool = getPool();
    await upsertUserEmbedding(pool, userId, embedding);

    return res.status(200).json({ success: true, userId, embeddingDim: embedding.length });
  } catch (error) {
    console.error("Error updating user embedding:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
