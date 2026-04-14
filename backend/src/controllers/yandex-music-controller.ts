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
    const response: RawPlaylistResponse = await getPlaylistByUUID(uuid);

    // Подготовим треки в удобном для фронтенда формате и сразу нормализуем обложки
    const tracks: PlaylistTrackItem[] = response.tracks.map((track) => {
      return {
        ...track,
        track: {
          ...track.track,
          ogImage: track.track.ogImage?.replace("%%", "300x300"),
          albums: track.track.albums.map((album) => ({
            ...album,
            coverUri: album.coverUri?.replace("%%", "300x300"),
          })),
        },
      };
    });

    const parsedResponse = {
      playlistUuid: response.playlistUuid,
      user: response.owner,
      tracks,
      title: response.title,
      cover: response.ogImage?.replace("%%", "300x300"),
    };

    res.send(parsedResponse);
  } catch (e) {
    res.send(400);
    console.error(e);
  }
};
