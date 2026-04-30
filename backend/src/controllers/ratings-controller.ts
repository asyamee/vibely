import type { Request, Response } from "express";
import { getPlaylistByUUID } from "../api/get-playlists-by-uuid.js";
import {
  addUserPlaylistRecord,
  exportEventsForTraining,
  getOrCreateArtistInternalId,
  getOrCreateGenreInternalId,
  getOrCreateTrackInternalId,
  getPool,
  insertUserEvent,
  upsertUser,
} from "../db/postgres.js";
import { computeAndSaveEmbedding } from "../services/embedding-service.js";

type Stars = 1 | 2 | 3 | 4 | 5;

type RatingItem = {
  playlistUuid: string;
  trackId: number;
  title: string;
  artistsIds: number[];
  trackGenre?: string | null;
  coverUrl?: string;
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
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

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

      // userId из JWT, плейлист грузим только для контента
      await getPlaylistByUUID(body.mainPlaylistUuid);

      // Не передаём displayName/avatar — фикс upsertUser теперь не затирает их
      await upsertUser(client as any, userId);

      // Регистрируем основной плейлист (учитывается в обучении)
      await addUserPlaylistRecord(client, userId, body.mainPlaylistUuid, null, true);

      for (const r of body.ratings) {
        const rating = starsToRating(r.stars);

        const trackInternal = await getOrCreateTrackInternalId(client, r.trackId, {
          title: r?.title || '',
          coverUrl: r?.coverUrl || '',
          artistIdsExternal: r?.artistsIds,
        });
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

      // Асинхронно вычисляем эмбеддинг и сохраняем (не блокируем ответ)
      computeAndSaveEmbedding(pool, userId).catch((err) =>
        console.error("Embedding computation failed:", err),
      );

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
