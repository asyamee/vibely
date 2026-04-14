export type Artist = {
  id: number;
  name: string;
};

export type TrackExtended = {
  id: string;
  realId: string;
  title: string;
  artists: Artist[];
  albums: { id: number; title: string; genre?: string }[];
  ogImage: string;
};

export type PlaylistTrackItem = {
  id: number;
  track: TrackExtended;
};

export type PlaylistResponse = {
  playlistUuid: string;
  title: string;
  cover: string;
  tracks: PlaylistTrackItem[];
};

export type Phase = "idle" | "rating_main" | "rating_extra" | "done";

export type RatedTrack = {
  playlistUuid: string;
  trackId: number;
  title: string;
  artistsIds: number[];
  trackGenre?: string | null;
  stars: 1 | 2 | 3 | 4 | 5;
};
