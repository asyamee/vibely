import { z } from "zod/v4";

export const ratingItemSchema = z.object({
  playlistUuid: z.string(),
  trackId: z.number().int(),
  title: z.string(),
  artistsIds: z.array(z.number().int()),
  trackGenre: z.string().nullish(),
  coverUrl: z.string().optional(),
  stars: z.number().int().min(1).max(5),
});

export const saveRatingsSchema = z.object({
  mainPlaylistUuid: z.string().min(1),
  ratings: z.array(ratingItemSchema).min(1),
});

export type TRatingItem = z.infer<typeof ratingItemSchema>;
export type TSaveRatingsInput = z.infer<typeof saveRatingsSchema>;
