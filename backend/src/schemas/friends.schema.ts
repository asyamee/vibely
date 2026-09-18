import { z } from "zod/v4";

export const sendFriendRequestSchema = z.object({
  targetUserId: z.string().uuid(),
});

export type TSendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
