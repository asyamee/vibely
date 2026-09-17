import {
  acceptFriendRequest,
  addFriendRequest,
  getPool,
  getUser,
  rejectFriendRequest,
  removeFriendship,
} from "../../db/postgres.js";
import { AppError } from "../../lib/app-error.js";

export async function sendFriendRequest(userId: string, targetUserId: string): Promise<void> {
  if (userId === targetUserId) {
    throw new AppError("Нельзя отправить заявку самому себе", 400);
  }

  const pool = getPool();

  // BB5: validate targetUserId exists
  const target = await getUser(pool, targetUserId);
  if (!target) {
    throw new AppError("Пользователь не найден", 404);
  }

  await addFriendRequest(pool, userId, targetUserId);
}

export async function acceptFriend(userId: string, friendId: string): Promise<void> {
  const pool = getPool();
  await acceptFriendRequest(pool, userId, friendId);
}

export async function rejectFriend(userId: string, friendId: string): Promise<void> {
  const pool = getPool();
  await rejectFriendRequest(pool, userId, friendId);
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const pool = getPool();
  await removeFriendship(pool, userId, friendId);
}
