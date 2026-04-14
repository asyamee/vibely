import { initAxiosInstance } from "../axios-instance.js";
import dotenv from "dotenv";
import type { PlaylistTrackItem } from "../types/playlist-track.types.js";
import type { PlaylistOwner } from "../types/playlist-owner.types.js";

dotenv.config();

const access_token = process.env.ACCESS_TOKEN || "";
const instance = initAxiosInstance(access_token);

export const getPlaylistByUUID = async (
  uuid: string,
): Promise<{
  playlistUuid: string;
  owner: PlaylistOwner;
  tracks: PlaylistTrackItem[];
  trackCount: number;
  title: string;
  ogImage: string;
}> => {
  try {
    const response = await instance.get(`/playlist/${uuid}`);

    return response.data.result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
