import { getPlaylistByUUID } from "../../api/get-playlists-by-uuid.js";
import {
  addUserPlaylistRecord,
  batchGetOrCreateArtistIds,
  batchGetOrCreateGenreIds,
  batchGetOrCreateTrackIds,
  batchInsertUserEvents,
  getPool,
  upsertUser,
} from "../../db/postgres.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import { starsToRating } from "../../lib/rating.js";
import type { TSaveRatingsInput } from "../../schemas/ratings.schema.js";
import { computeAndSaveEmbedding } from "../embedding-service.js";

export async function saveRatings(userId: string, input: TSaveRatingsInput): Promise<void> {
  const pool = getPool();
  const ts = new Date().toISOString();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await getPlaylistByUUID(input.mainPlaylistUuid);
    await upsertUser(client as never, userId);
    await addUserPlaylistRecord(client, userId, input.mainPlaylistUuid, null, true);

    const uniqueTracks = [
      ...new Map(input.ratings.map((r) => [r.trackId, r])).values(),
    ].map((r) => ({ externalId: r.trackId, title: r.title, coverUrl: r.coverUrl ?? undefined }));

    const uniqueGenres = [...new Set(input.ratings.map((r) => r.trackGenre ?? "unknown"))];
    const uniqueArtistIds = [...new Set(input.ratings.flatMap((r) => r.artistsIds))];

    const [trackIdMap, genreIdMap, artistIdMap] = await Promise.all([
      batchGetOrCreateTrackIds(client, uniqueTracks),
      batchGetOrCreateGenreIds(client, uniqueGenres),
      batchGetOrCreateArtistIds(client, uniqueArtistIds),
    ]);

    await batchInsertUserEvents(
      client,
      input.ratings.map((r) => {
        const trackId = trackIdMap.get(r.trackId);
        const genreId = genreIdMap.get(r.trackGenre ?? "unknown");
        if (trackId === undefined || genreId === undefined) {
          throw new AppError("ID mapping failed: missing track or genre", 500);
        }
        return {
          user_id: userId,
          playlist_uuid: r.playlistUuid,
          track_id: trackId,
          genre_id: genreId,
          artist_ids: r.artistsIds.map((a) => {
            const aid = artistIdMap.get(a);
            if (aid === undefined) throw new AppError("ID mapping failed: missing artist", 500);
            return aid;
          }),
          rating: starsToRating(r.stars as 1 | 2 | 3 | 4 | 5),
          ts,
        };
      }),
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Fire-and-forget: не блокируем ответ
  computeAndSaveEmbedding(pool, userId).catch((err) =>
    logger.error({ err }, "Embedding computation failed"),
  );
}
