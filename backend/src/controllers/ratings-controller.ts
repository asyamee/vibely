import type { Request, Response } from "express";
import { getPlaylistByUUID } from "../api/get-playlists-by-uuid.js";
import {
  exportEventsForTraining,
  getOrCreateArtistInternalId,
  getOrCreateGenreInternalId,
  getOrCreateTrackInternalId,
  getPool,
  insertUserEvent,
} from "../db/postgres.js";

type Stars = 1 | 2 | 3 | 4 | 5;

type RatingItem = {
  playlistUuid: string;
  trackId: number;
  title: string;
  artistsIds: number[];
  trackGenre?: string | null;
  stars: Stars;
};

type SaveRatingsBody = {
  mainPlaylistUuid: string;
  ratings: RatingItem[];
};

const starsToRating = (stars: Stars): number => {
  switch (stars) {
    case 1:
      return -1.0; // strong_dislike
    case 2:
      return -0.5; // dislike
    case 3:
      return -0.1; // neutral
    case 4:
      return 0.5; // like
    case 5:
      return 1.0; // strong_like
    default:
      return 0.0;
  }
};

export const saveRatings = (req: Request, res: Response) => {
  const body = req.body as SaveRatingsBody;

  if (
    !body?.mainPlaylistUuid ||
    !Array.isArray(body.ratings) ||
    body.ratings.length === 0
  ) {
    return res
      .status(400)
      .json({
        message: "mainPlaylistUuid и непустой список ratings обязательны",
      });
  }

  const pool = getPool();
  const ts = new Date().toISOString();

  (async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const mainPlaylist = await getPlaylistByUUID(body.mainPlaylistUuid);
      const userId = String(mainPlaylist.owner.uid);

      for (const r of body.ratings) {
        const rating = starsToRating(r.stars);

        const trackInternal = await getOrCreateTrackInternalId(
          client,
          r.trackId,
        );
        const genreInternal = await getOrCreateGenreInternalId(
          client,
          r.trackGenre ?? "unknown",
        );
        const artistsInternal = await Promise.all(
          r.artistsIds.map((a) => getOrCreateArtistInternalId(client, a)),
        );

        await insertUserEvent(client, {
          user_id: userId,
          playlist_uuid: r.playlistUuid,
          track_id: trackInternal,
          genre_id: genreInternal,
          artist_ids: artistsInternal,
          rating,
          ts,
        });
      }

      await client.query("COMMIT");
      return res.status(200).json({ message: "Рейтинги сохранены в Postgres" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      return res
        .status(500)
        .json({ message: "Ошибка записи рейтингов в Postgres" });
    } finally {
      client.release();
    }
  })().catch((err) => {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Ошибка записи рейтингов в Postgres" });
  });
};

export const exportTrainingJsonl = (req: Request, res: Response) => {
  const pool = getPool();
  (async () => {
    try {
      const jsonl = await exportEventsForTraining(pool);

      res.setHeader("Content-Type", "application/jsonl; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="user_events.jsonl"',
      );
      return res.status(200).send(jsonl.length ? `${jsonl}\n` : "");
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Ошибка экспорта" });
    }
  })().catch((err) => {
    console.error(err);
    return res.status(500).json({ message: "Ошибка экспорта" });
  });
};
