export interface IUser {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  genres?: string[];
}

export interface IUserCardData extends IUser {
  similarity?: number;
  favoriteTracks?: Array<{ track_id: number; title: string; artist: string }>;
}
