import { getPool, getRandomTracks as dbGetRandomTracks } from "../../db/postgres.js";
import { logger } from "../../lib/logger.js";

export interface IRandomTrackArtist {
  id: number;
  name: string;
}

export interface IRandomTrackAlbum {
  id: number;
  title: string;
  genre: undefined;
}

export interface IRandomTrack {
  id: number;
  track: {
    id: string;
    realId: string;
    title: string;
    artists: IRandomTrackArtist[];
    albums: IRandomTrackAlbum[];
    ogImage: string;
  };
}

export async function getRandomTracks(count: number): Promise<IRandomTrack[]> {
  const pool = getPool();
  const rows = await dbGetRandomTracks(pool, count);

  logger.debug({ count, returned: rows.length }, "getRandomTracks complete");

  return rows.map((t) => ({
    id: t.id_external,
    track: {
      id: String(t.id_external),
      realId: String(t.id_external),
      title: t.title,
      artists: t.artist_ids_external.map((artistId) => ({ id: artistId, name: "" })),
      albums: [{ id: 0, title: "", genre: undefined }],
      ogImage: t.cover_url,
    },
  }));
}
