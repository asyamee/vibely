import type { Request, Response } from "express";
import { compare, hash } from "bcrypt";
import {
  deleteUserCascade,
  getFriendshipStatus,
  getPool,
  getUser,
  getUserFavoriteTracks,
  getUserGenres,
  getUserPasswordHash,
  setUserGenres,
  updateUserContacts,
  updateUserPasswordHash,
  upsertUser,
  upsertUserEmbedding,
} from "../db/postgres.js";

const pickParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const defaultAvatar = (userId: string) =>
  `https://avatars.yandex.net/get-yapic/${userId}/islands-retina-50`;

export const getProfile = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const pool = getPool();
    const user = await getUser(pool, userId);
    const genres = await getUserGenres(pool, userId);
    const favoriteTracks = await getUserFavoriteTracks(pool, userId, 5);

    const requesterId = req.user?.userId;
    const isSelf = requesterId === userId;
    let friendshipStatus: "self" | "none" | "pending_outgoing" | "pending_incoming" | "accepted" =
      "none";
    if (isSelf) {
      friendshipStatus = "self";
    } else if (requesterId) {
      friendshipStatus = await getFriendshipStatus(pool, requesterId, userId);
    }

    const showContacts = isSelf || friendshipStatus === "accepted";

    const profile = {
      userId,
      displayName: user?.display_name || null,
      avatarUrl: user?.avatar_url || defaultAvatar(userId),
      genres,
      favoriteTracks,
      friendshipStatus,
      contacts: showContacts
        ? {
            telegram: user?.telegram || null,
            phone: user?.phone || null,
            contactEmail: user?.contact_email || null,
          }
        : null,
    };

    return res.status(200).json(profile);
  } catch (error) {
    console.error("Error getting profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const { displayName, genres, telegram, phone, contactEmail } = req.body as {
    displayName?: string;
    genres?: string[];
    telegram?: string | null;
    phone?: string | null;
    contactEmail?: string | null;
  };

  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const pool = getPool();
    await upsertUser(pool, userId, displayName);

    if (genres && Array.isArray(genres)) {
      await setUserGenres(pool, userId, genres);
    }

    if (
      telegram !== undefined ||
      phone !== undefined ||
      contactEmail !== undefined
    ) {
      const current = await getUser(pool, userId);
      await updateUserContacts(pool, userId, {
        telegram: telegram !== undefined ? telegram : current?.telegram ?? null,
        phone: phone !== undefined ? phone : current?.phone ?? null,
        contactEmail:
          contactEmail !== undefined ? contactEmail : current?.contact_email ?? null,
      });
    }

    const fresh = await getUser(pool, userId);
    return res.status(200).json({
      userId,
      displayName: fresh?.display_name || null,
      avatarUrl: fresh?.avatar_url || defaultAvatar(userId),
      genres: genres || (await getUserGenres(pool, userId)),
      contacts: {
        telegram: fresh?.telegram || null,
        phone: fresh?.phone || null,
        contactEmail: fresh?.contact_email || null,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const upsertUserProfile = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const { displayName, genres } = req.body as {
    displayName?: string;
    genres?: string[];
  };
  if (!userId) return res.status(400).json({ message: "userId is required" });

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

export const updateUserEmbedding = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const { embedding } = req.body as { embedding?: number[] };

  if (!userId) return res.status(400).json({ message: "userId is required" });
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

export const changePassword = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword и newPassword обязательны" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Новый пароль минимум 8 символов" });
  }

  try {
    const pool = getPool();
    const currentHash = await getUserPasswordHash(pool, userId);
    if (!currentHash) return res.status(404).json({ message: "User not found" });

    const ok = await compare(currentPassword, currentHash);
    if (!ok) return res.status(401).json({ message: "Неверный текущий пароль" });

    const newHash = await hash(newPassword, 12);
    await updateUserPasswordHash(pool, userId, newHash);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const { currentPassword } = req.body as { currentPassword?: string };
  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!currentPassword) {
    return res.status(400).json({ message: "currentPassword обязателен" });
  }

  try {
    const pool = getPool();
    const currentHash = await getUserPasswordHash(pool, userId);
    if (!currentHash) return res.status(404).json({ message: "User not found" });

    const ok = await compare(currentPassword, currentHash);
    if (!ok) return res.status(401).json({ message: "Неверный пароль" });

    await deleteUserCascade(pool, userId);

    const base = {
      path: "/",
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    };
    res.clearCookie("refreshToken", base);
    res.clearCookie("accessToken", base);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
