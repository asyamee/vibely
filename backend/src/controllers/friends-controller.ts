import type { Request, Response } from "express";
import {
  acceptFriendRequest,
  addFriendRequest,
  getPendingFriendRequests,
  getPool,
  getUserFriends,
  rejectFriendRequest,
  removeFriendship,
} from "../db/postgres.js";

const pickParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const defaultAvatar = (userId: string) =>
  `https://avatars.yandex.net/get-yapic/${userId}/islands-retina-50`;

export const getFriends = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const pool = getPool();
    const friends = await getUserFriends(pool, userId);

    return res.status(200).json({
      userId,
      friends: friends.map((f) => ({
        userId: f.user_id,
        displayName: f.display_name || null,
        avatarUrl: f.avatar_url || defaultAvatar(f.user_id),
        contacts: {
          telegram: f.telegram || null,
          phone: f.phone || null,
          contactEmail: f.contact_email || null,
        },
      })),
    });
  } catch (error) {
    console.error("Error getting friends:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const sendFriendRequest = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const { targetUserId } = req.body as { targetUserId?: string };

  if (!userId || !targetUserId) {
    return res.status(400).json({ message: "userId and targetUserId are required" });
  }
  if (userId === targetUserId) {
    return res.status(400).json({ message: "Нельзя отправить заявку самому себе" });
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
  const userId = pickParam(req.params.userId);
  const friendId = pickParam(req.params.friendId);
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

export const rejectFriend = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const friendId = pickParam(req.params.friendId);
  if (!userId || !friendId) {
    return res.status(400).json({ message: "userId and friendId are required" });
  }

  try {
    const pool = getPool();
    await rejectFriendRequest(pool, userId, friendId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error rejecting friend request:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removeFriend = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const friendId = pickParam(req.params.friendId);
  if (!userId || !friendId) {
    return res.status(400).json({ message: "userId и friendId обязательны" });
  }

  try {
    const pool = getPool();
    await removeFriendship(pool, userId, friendId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error removing friend:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const listPendingRequests = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const pool = getPool();
    const pending = await getPendingFriendRequests(pool, userId);
    return res.status(200).json({
      userId,
      requests: pending.map((p) => ({
        userId: p.user_id,
        displayName: p.display_name || null,
        avatarUrl: p.avatar_url || defaultAvatar(p.user_id),
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    console.error("Error listing pending requests:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
