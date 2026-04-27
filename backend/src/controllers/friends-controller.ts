import type { Request, Response } from "express";
import {
  getPool,
  getUserFriends,
  addFriendRequest,
  acceptFriendRequest,
} from "../db/postgres.js";

export const getFriends = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const pool = getPool();
    const friends = await getUserFriends(pool, userId);

    return res.status(200).json({
      userId,
      friends: friends.map((f) => ({
        userId: f.user_id,
        displayName: f.display_name || "Unknown",
        avatarUrl:
          f.avatar_url || `https://avatars.yandex.net/get-yapic/${f.user_id}/islands-retina-50`,
      })),
    });
  } catch (error) {
    console.error("Error getting friends:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const sendFriendRequest = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { targetUserId } = req.body as { targetUserId?: string };

  if (!userId || !targetUserId) {
    return res.status(400).json({ message: "userId and targetUserId are required" });
  }

  try {
    const pool = getPool();
    await addFriendRequest(pool, userId, targetUserId);

    return res.status(200).json({ success: true, message: "Friend request sent" });
  } catch (error) {
    console.error("Error sending friend request:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptFriend = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const friendId = Array.isArray(req.params.friendId) ? req.params.friendId[0] : req.params.friendId;

  if (!userId || !friendId) {
    return res.status(400).json({ message: "userId and friendId are required" });
  }

  try {
    const pool = getPool();
    await acceptFriendRequest(pool, userId, friendId);

    return res.status(200).json({ success: true, message: "Friend request accepted" });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
