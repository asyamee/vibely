import {
  addUserPlaylistRecord,
  getOrCreateArtistInternalId,
  getOrCreateGenreInternalId,
  getOrCreateTrackInternalId,
  getPool,
  insertUserEvent,
  listUserPlaylists,
  removeUserPlaylistRecord,
  upsertUser,
} from "../../db/postgres.js";
import { logger } from "../../lib/logger.js";
import { starsToRating } from "../../lib/rating.js";
import type { TAddPlaylistInput } from "../../schemas/playlists.schema.js";
import { computeAndSaveEmbedding } from "../embedding-service.js";

export interface IPlaylistItem {
  playlistUuid: string;
  title: string | null;
  isPrimary: boolean;
  addedAt: string;
}

export async function listPlaylists(userId: string): Promise<IPlaylistItem[]> {
  const pool = getPool();
  const items = await listUserPlaylists(pool, userId);

  return items.map((p) => ({
    playlistUuid: p.playlist_uuid,
    title: p.title,
    isPrimary: p.is_primary,
    addedAt: p.added_at,
  }));
}

export async function addPlaylist(
  userId: string,
  input: TAddPlaylistInput,
): Promise<{ playlistUuid: string }> {
  const pool = getPool();
  const ts = new Date().toISOString();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertUser(client as never, userId);
    await addUserPlaylistRecord(client, userId, input.playlistUuid, input.title ?? null, false);

    for (const r of input.ratings) {
      const trackInternal = await getOrCreateTrackInternalId(client, r.trackId, {
        title: r.title ?? "",
        coverUrl: r.coverUrl ?? "",
        artistIdsExternal: r.artistsIds,
      });
      const genreInternal = await getOrCreateGenreInternalId(
        client,
        r.trackGenre ?? "unknown",
      );
      const artistsInternal = await Promise.all(
        (r.artistsIds ?? []).map((a) => getOrCreateArtistInternalId(client, a)),
      );

      await insertUserEvent(client, {
        user_id: userId,
        playlist_uuid: input.playlistUuid,
        track_id: trackInternal,
        genre_id: genreInternal,
        artist_ids: artistsInternal,
        rating: starsToRating(r.stars as 1 | 2 | 3 | 4 | 5),
        ts,
        include_in_training: false,
      });
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  // Fire-and-forget embedding recompute
  computeAndSaveEmbedding(pool, userId).catch((err) =>
    logger.error({ err }, "Embedding recompute failed"),
  );

  return { playlistUuid: input.playlistUuid };
}

export async function removePlaylist(userId: string, playlistUuid: string): Promise<void> {
  const pool = getPool();
  await removeUserPlaylistRecord(pool, userId, playlistUuid);

  // Fire-and-forget embedding recompute
  computeAndSaveEmbedding(pool, userId).catch((err) =>
    logger.error({ err }, "Embedding recompute failed"),
  );
}
