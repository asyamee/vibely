import type { Request, Response } from "express";
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
} from "../db/postgres.js";
import { computeAndSaveEmbedding } from "../services/embedding-service.js";

const pickParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

type Stars = 1 | 2 | 3 | 4 | 5;
type RatingItem = {
  trackId: number;
  title: string;
  artistsIds: number[];
  trackGenre?: string | null;
  coverUrl?: string;
  stars: Stars;
};

const starsToRating = (stars: Stars): number => {
  switch (stars) {
    case 1: return -1.0;
    case 2: return -0.5;
    case 3: return -0.1;
    case 4: return 0.5;
    case 5: return 1.0;
    default: return 0.0;
  }
};

export const listMyPlaylists = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const pool = getPool();
    const items = await listUserPlaylists(pool, userId);
    return res.status(200).json({
      userId,
      playlists: items.map((p) => ({
        playlistUuid: p.playlist_uuid,
        title: p.title,
        isPrimary: p.is_primary,
        addedAt: p.added_at,
      })),
    });
  } catch (error) {
    console.error("Error listing playlists:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

type AddPlaylistBody = {
  playlistUuid?: string;
  title?: string;
  ratings?: RatingItem[];
};

export const addPlaylist = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const { playlistUuid, title, ratings } = req.body as AddPlaylistBody;
  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!playlistUuid || !Array.isArray(ratings) || ratings.length === 0) {
    return res.status(400).json({ message: "playlistUuid и ratings обязательны" });
  }

  const pool = getPool();
  const ts = new Date().toISOString();

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await upsertUser(client as any, userId);
      await addUserPlaylistRecord(client, userId, playlistUuid, title || null, false);

      for (const r of ratings) {
        const trackInternal = await getOrCreateTrackInternalId(client, r.trackId, {
          title: r.title || "",
          coverUrl: r.coverUrl || "",
          artistIdsExternal: r.artistsIds,
        });
        const genreInternal = await getOrCreateGenreInternalId(
          client,
          r.trackGenre ?? "unknown",
        );
        const artistsInternal = await Promise.all(
          (r.artistsIds || []).map((a) => getOrCreateArtistInternalId(client, a)),
        );

        await insertUserEvent(client, {
          user_id: userId,
          playlist_uuid: playlistUuid,
          track_id: trackInternal,
          genre_id: genreInternal,
          artist_ids: artistsInternal,
          rating: starsToRating(r.stars),
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

    try {
      await computeAndSaveEmbedding(pool, userId);
    } catch (err) {
      console.error("Embedding recompute failed:", err);
    }

    return res.status(200).json({ success: true, playlistUuid });
  } catch (error) {
    console.error("Error adding playlist:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removePlaylist = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const playlistUuid = pickParam(req.params.playlistUuid);
  if (!userId || !playlistUuid) {
    return res.status(400).json({ message: "userId и playlistUuid обязательны" });
  }

  try {
    const pool = getPool();
    await removeUserPlaylistRecord(pool, userId, playlistUuid);

    try {
      await computeAndSaveEmbedding(pool, userId);
    } catch (err) {
      console.error("Embedding recompute failed:", err);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error removing playlist:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
