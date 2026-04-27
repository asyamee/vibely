export interface User {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  genres?: string[];
}

export interface UserCardData extends User {
  similarity?: number;
  favoriteTracks?: Array<{ track_id: number; title: string; artist: string }>;
}
