import { apiClient } from "./client";

export interface IPlaylistResponse {
  playlistUuid: string;
  title: string;
  cover: string;
  tracks: IPlaylistTrackItem[];
}

export interface IPlaylistTrackItem {
  id: number;
  track: {
    id: string;
    realId: string;
    title: string;
    artists: Array<{ id: number; name: string }>;
    albums: Array<{ id: number; title: string; genre?: string }>;
    ogImage: string;
  };
}

export interface IRatingItem {
  playlistUuid: string;
  trackId: number;
  title: string;
  artistsIds: number[];
  trackGenre?: string | null;
  coverUrl?: string;
  stars: 1 | 2 | 3 | 4 | 5;
}

export interface ISaveRatingsBody {
  mainPlaylistUuid: string;
  ratings: IRatingItem[];
}

export async function getPlaylist(
  uuid: string,
  params?: { shuffle?: boolean; limit?: number },
): Promise<IPlaylistResponse> {
  const response = await apiClient.get<IPlaylistResponse>(`/playlist/${uuid}`, { params });
  return response.data;
}

export async function saveRatings(body: ISaveRatingsBody): Promise<void> {
  await apiClient.post("/ratings", body);
}

export async function getRandomTracks(count: number = 10): Promise<IPlaylistTrackItem[]> {
  const response = await apiClient.get<IPlaylistTrackItem[]>(`/tracks/random?count=${count}`);
  return response.data;
}

export async function exportTrainingJsonl(): Promise<Blob> {
  const response = await apiClient.get("/ratings/export-jsonl", {
    responseType: "blob",
  });
  return response.data;
}
