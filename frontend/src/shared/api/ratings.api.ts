import { apiClient } from "./client";

export interface PlaylistResponse {
  playlistUuid: string;
  title: string;
  cover: string;
  tracks: PlaylistTrackItem[];
}

export interface PlaylistTrackItem {
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

export interface RatingItem {
  playlistUuid: string;
  trackId: number;
  title: string;
  artistsIds: number[];
  trackGenre?: string | null;
  coverUrl?: string;
  stars: 1 | 2 | 3 | 4 | 5;
}

export interface SaveRatingsBody {
  mainPlaylistUuid: string;
  ratings: RatingItem[];
}

export async function getPlaylist(
  uuid: string,
  params?: { shuffle?: boolean; limit?: number },
): Promise<PlaylistResponse> {
  const response = await apiClient.get<PlaylistResponse>(`/playlist/${uuid}`, { params });
  return response.data;
}

export async function saveRatings(body: SaveRatingsBody): Promise<void> {
  await apiClient.post("/ratings", body);
}

export async function getRandomTracks(count: number = 10): Promise<PlaylistTrackItem[]> {
  const response = await apiClient.get<PlaylistTrackItem[]>(`/tracks/random?count=${count}`);
  return response.data;
}

export async function exportTrainingJsonl(): Promise<Blob> {
  const response = await apiClient.get("/ratings/export-jsonl", {
    responseType: "blob",
  });
  return response.data;
}
