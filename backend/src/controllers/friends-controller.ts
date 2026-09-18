import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { pickParam } from "../lib/request.js";
import { sendSuccess } from "../lib/response.js";
import {
  getFriends as getFriendsService,
  listPendingRequests as listPendingRequestsService,
  sendFriendRequest as sendFriendRequestService,
  acceptFriend as acceptFriendService,
  rejectFriend as rejectFriendService,
  removeFriend as removeFriendService,
} from "../services/friends/index.js";

export const getFriends = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId is required", 400);
  const result = await getFriendsService(userId);
  sendSuccess(res, result);
};

export const sendFriendRequest = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId is required", 400);
  await sendFriendRequestService(userId, req.body.targetUserId);
  sendSuccess(res, { success: true, message: "Friend request sent" });
};

export const acceptFriend = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const friendId = pickParam(req.params.friendId);
  if (!userId || !friendId) throw new AppError("userId and friendId are required", 400);
  await acceptFriendService(userId, friendId);
  sendSuccess(res, { success: true, message: "Friend request accepted" });
};

export const rejectFriend = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const friendId = pickParam(req.params.friendId);
  if (!userId || !friendId) throw new AppError("userId and friendId are required", 400);
  await rejectFriendService(userId, friendId);
  sendSuccess(res, { success: true });
};

export const removeFriend = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const friendId = pickParam(req.params.friendId);
  if (!userId || !friendId) throw new AppError("userId и friendId обязательны", 400);
  await removeFriendService(userId, friendId);
  sendSuccess(res, { success: true });
};

export const listPendingRequests = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId is required", 400);
  const requests = await listPendingRequestsService(userId);
  sendSuccess(res, { userId, requests });
};
