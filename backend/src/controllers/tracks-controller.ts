import type { Request, Response } from "express";
import { getPool, getRandomTracks } from "../db/postgres.js";

export const getRandomTracksHandler = (req: Request, res: Response) => {
  const count = Math.min(50, Math.max(1, Number.parseInt((req.query.count as string) ?? "10", 10)));
  const pool = getPool();

  (async () => {
    try {
      const tracks = await getRandomTracks(pool, count);

      const result = tracks.map((t) => ({
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

      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Ошибка получения случайных треков" });
    }
  })().catch((err) => {
    console.error(err);
    return res.status(500).json({ message: "Ошибка получения случайных треков" });
  });
};
