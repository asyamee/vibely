import { z } from "zod/v4";

const playlistRatingItemSchema = z.object({
  trackId: z.number().int(),
  title: z.string(),
  artistsIds: z.array(z.number().int()),
  trackGenre: z.string().nullish(),
  coverUrl: z.string().optional(),
  stars: z.number().int().min(1).max(5),
});

export const addPlaylistSchema = z.object({
  playlistUuid: z.string().min(1),
  title: z.string().optional(),
  ratings: z.array(playlistRatingItemSchema).min(1),
});

export type TAddPlaylistInput = z.infer<typeof addPlaylistSchema>;
