import {
  getFriendshipStatus,
  getPool,
  getUser,
  getUserFavoriteTracks,
  getUserGenres,
  setUserGenres,
  updateUserContacts,
  upsertUser,
} from "../../db/postgres.js";
import { defaultAvatar } from "../../lib/request.js";
import { logger } from "../../lib/logger.js";
import type { TUpdateProfileInput } from "../../schemas/users.schema.js";

export interface IProfileResult {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  genres: string[];
  favoriteTracks?: unknown[];
  friendshipStatus?: "self" | "none" | "pending_outgoing" | "pending_incoming" | "accepted";
  contacts: {
    telegram: string | null;
    phone: string | null;
    contactEmail: string | null;
  } | null;
}

export async function getProfile(userId: string, requesterId?: string): Promise<IProfileResult> {
  const pool = getPool();
  const user = await getUser(pool, userId);
  const genres = await getUserGenres(pool, userId);
  const favoriteTracks = await getUserFavoriteTracks(pool, userId, 5);

  const isSelf = requesterId === userId;
  let friendshipStatus: "self" | "none" | "pending_outgoing" | "pending_incoming" | "accepted" =
    "none";
  if (isSelf) {
    friendshipStatus = "self";
  } else if (requesterId) {
    friendshipStatus = await getFriendshipStatus(pool, requesterId, userId);
  }

  const showContacts = isSelf || friendshipStatus === "accepted";

  logger.debug({ userId, requesterId, friendshipStatus }, "getProfile");

  return {
    userId,
    displayName: user?.display_name ?? null,
    avatarUrl: user?.avatar_url ?? defaultAvatar(userId),
    genres,
    favoriteTracks,
    friendshipStatus,
    contacts: showContacts
      ? {
          telegram: user?.telegram ?? null,
          phone: user?.phone ?? null,
          contactEmail: user?.contact_email ?? null,
        }
      : null,
  };
}

export async function updateProfile(
  userId: string,
  input: TUpdateProfileInput,
): Promise<IProfileResult> {
  const { displayName, genres, telegram, phone, contactEmail } = input;
  const pool = getPool();

  await upsertUser(pool, userId, displayName);

  if (genres && Array.isArray(genres)) {
    await setUserGenres(pool, userId, genres);
  }

  if (telegram !== undefined || phone !== undefined || contactEmail !== undefined) {
    const current = await getUser(pool, userId);
    await updateUserContacts(pool, userId, {
      telegram: telegram !== undefined ? (telegram ?? null) : (current?.telegram ?? null),
      phone: phone !== undefined ? (phone ?? null) : (current?.phone ?? null),
      contactEmail:
        contactEmail !== undefined ? (contactEmail ?? null) : (current?.contact_email ?? null),
    });
  }

  const fresh = await getUser(pool, userId);
  const freshGenres = genres ?? (await getUserGenres(pool, userId));

  logger.debug({ userId }, "updateProfile");

  return {
    userId,
    displayName: fresh?.display_name ?? null,
    avatarUrl: fresh?.avatar_url ?? defaultAvatar(userId),
    genres: freshGenres,
    contacts: {
      telegram: fresh?.telegram ?? null,
      phone: fresh?.phone ?? null,
      contactEmail: fresh?.contact_email ?? null,
    },
  };
}

export async function upsertProfile(
  userId: string,
  input: { displayName?: string; genres?: string[] },
): Promise<void> {
  const { displayName, genres } = input;
  const pool = getPool();

  await upsertUser(pool, userId, displayName);
  if (genres && Array.isArray(genres)) {
    await setUserGenres(pool, userId, genres);
  }

  logger.debug({ userId }, "upsertProfile");
}
