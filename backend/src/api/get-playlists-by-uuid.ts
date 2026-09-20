import { initAxiosInstance } from "../axios-instance.js";
import dotenv from "dotenv";
import type { PlaylistTrackItem } from "../types/playlist-track.types.js";
import type { PlaylistOwner } from "../types/playlist-owner.types.js";

dotenv.config();

let instance: ReturnType<typeof initAxiosInstance> | null = null;

function getInstance() {
  if (!instance) {
    instance = initAxiosInstance(process.env.ACCESS_TOKEN || "");
  }
  return instance;
}

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
    const response = await getInstance().get(`/playlist/${uuid}`);

    return response.data.result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
