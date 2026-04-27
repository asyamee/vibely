import type { Request, Response } from "express";
import axios from "axios";
import { getPlaylistByUUID } from "../api/get-playlists-by-uuid.js";
import {
  exportEventsForTraining,
  getOrCreateArtistInternalId,
  getOrCreateGenreInternalId,
  getOrCreateTrackInternalId,
  getPool,
  insertUserEvent,
  upsertUser,
  upsertUserEmbedding,
} from "../db/postgres.js";

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

      // Upsert user profile with default values
      await upsertUser(client as any, userId);

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

async function computeAndSaveEmbedding(
  pool: InstanceType<typeof import("pg").Pool>,
  userId: string,
): Promise<void> {
  try {
    // 1. Загрузить историю пользователя из user_events
    const result = await pool.query(
      `SELECT ue.track_id, ue.genre_id, ue.artist_ids, ue.rating
       FROM user_events ue WHERE ue.user_id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      console.log(`No events found for user ${userId}`);
      return;
    }

    // 2. Подготовить payload для AI-сервиса
    const tracks = result.rows.map(
      (r: {
        track_id: number;
        genre_id: number;
        artist_ids: number[];
        rating: number;
      }) => ({
        id: r.track_id,
        genre_id: r.genre_id,
        artist_ids: r.artist_ids,
        rating: r.rating,
      }),
    );

    // 3. Вызвать AI-сервис
    const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const response = await axios.post(`${aiUrl}/compute-embedding`, {
      user_id: userId,
      tracks,
    }, { timeout: 10_000 });

    const embedding: number[] = response.data.embedding;

    // 4. Сохранить в postgres
    await upsertUserEmbedding(pool, userId, embedding);
    console.log(`Embedding computed and saved for user ${userId}`);
  } catch (err) {
    console.error(`Failed to compute embedding for user ${userId}:`, err);
  }
}

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
