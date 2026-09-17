import type { Request, Response } from "express";
import { getPlaylistByUUID } from "../api/get-playlists-by-uuid.js";
import {
  addUserPlaylistRecord,
  batchGetOrCreateArtistIds,
  batchGetOrCreateGenreIds,
  batchGetOrCreateTrackIds,
  batchInsertUserEvents,
  exportEventsForTraining,
  getPool,
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

export const saveRatings = async (req: Request, res: Response) => {
  const body = req.body as SaveRatingsBody;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!body?.mainPlaylistUuid || !Array.isArray(body.ratings) || body.ratings.length === 0) {
    return res.status(400).json({ message: "mainPlaylistUuid и непустой список ratings обязательны" });
  }

  const pool = getPool();
  const ts = new Date().toISOString();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await getPlaylistByUUID(body.mainPlaylistUuid);
    await upsertUser(client as any, userId);
    await addUserPlaylistRecord(client, userId, body.mainPlaylistUuid, null, true);

    // Собираем уникальные треки, жанры и артистов — три batch-запроса вместо ~300.
    const uniqueTracks = [
      ...new Map(body.ratings.map((r) => [r.trackId, r])).values(),
    ].map((r) => ({ externalId: r.trackId, title: r.title, coverUrl: r.coverUrl ?? undefined }));

    const uniqueGenres = [...new Set(body.ratings.map((r) => r.trackGenre ?? "unknown"))];
    const uniqueArtistIds = [...new Set(body.ratings.flatMap((r) => r.artistsIds))];

    const [trackIdMap, genreIdMap, artistIdMap] = await Promise.all([
      batchGetOrCreateTrackIds(client, uniqueTracks),
      batchGetOrCreateGenreIds(client, uniqueGenres),
      batchGetOrCreateArtistIds(client, uniqueArtistIds),
    ]);

    await batchInsertUserEvents(
      client,
      body.ratings.map((r) => {
        const trackId = trackIdMap.get(r.trackId);
        const genreId = genreIdMap.get(r.trackGenre ?? "unknown");
        if (trackId === undefined || genreId === undefined) {
          throw Object.assign(new Error("ID mapping failed: missing track or genre"), { statusCode: 500 });
        }
        return {
          user_id: userId,
          playlist_uuid: r.playlistUuid,
          track_id: trackId,
          genre_id: genreId,
          artist_ids: r.artistsIds.map((a) => {
            const aid = artistIdMap.get(a);
            if (aid === undefined) throw Object.assign(new Error("ID mapping failed: missing artist"), { statusCode: 500 });
            return aid;
          }),
          rating: starsToRating(r.stars),
          ts,
        };
      }),
    );

    await client.query("COMMIT");

    // Эмбеддинг считается асинхронно — не блокируем ответ.
    computeAndSaveEmbedding(pool, userId).catch((err) =>
      console.error("Embedding computation failed:", err),
    );

    return res.status(200).json({ message: "Рейтинги сохранены в Postgres" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ message: "Ошибка записи рейтингов в Postgres" });
  } finally {
    client.release();
  }
};

export const exportTrainingJsonl = async (req: Request, res: Response) => {
  try {
    const jsonl = await exportEventsForTraining(getPool());
    res.setHeader("Content-Type", "application/jsonl; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="user_events.jsonl"');
    return res.status(200).send(jsonl.length ? `${jsonl}\n` : "");
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Ошибка экспорта" });
  }
};
