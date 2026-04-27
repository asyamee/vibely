import type { Request, Response } from "express";
import { YMApi } from "ym-api";
import dotenv from "dotenv";
import { getPlaylistByUUID } from "../api/get-playlists-by-uuid.js";
import type { PlaylistTrackItem } from "../types/playlist-track.types.js";
import type { RawPlaylistResponse } from "../types/playlist.types.js";

dotenv.config();

// Инициализация клиента Yandex Music
const client = new YMApi();
const access_token = process.env.ACCESS_TOKEN || "";

client.init({
  access_token,
  uid: parseInt(process.env.USER_ID || ""),
});

/**
 * Получение плейлиста по UUID
 */
export const playlist_UUID = async (
  req: Request<{ uuid: string }>,
  res: Response,
) => {
  try {
    const { uuid } = req.params;
    const shuffle = req.query.shuffle === "true";
    const limit = req.query.limit ? Math.max(1, parseInt(req.query.limit as string, 10)) : undefined;

    const response: RawPlaylistResponse = await getPlaylistByUUID(uuid);

    let tracks: PlaylistTrackItem[] = response.tracks.map((track) => ({
      ...track,
      track: {
        ...track.track,
        ogImage: track.track.ogImage?.replace("%%", "300x300"),
        albums: track.track.albums.map((album) => ({
          ...album,
          coverUri: album.coverUri?.replace("%%", "300x300"),
        })),
      },
    }));

    if (shuffle) {
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j]!, tracks[i]!];
      }
    }

    if (limit !== undefined) {
      tracks = tracks.slice(0, limit);
    }

    res.json({
      playlistUuid: response.playlistUuid,
      user: response.owner,
      tracks,
      title: response.title,
      cover: response.ogImage?.replace("%%", "300x300"),
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: "Failed to fetch playlist from Yandex Music" });
  }
};
