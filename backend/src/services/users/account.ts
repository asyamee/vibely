import { compare, hash } from "bcrypt";
import {
  deleteUserCascade,
  getPool,
  getUserPasswordHash,
  updateUserPasswordHash,
} from "../../db/postgres.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import type { TChangePasswordInput } from "../../schemas/users.schema.js";

export async function changePassword(
  userId: string,
  input: TChangePasswordInput,
): Promise<void> {
  const { currentPassword, newPassword } = input;
  const pool = getPool();

  const currentHash = await getUserPasswordHash(pool, userId);
  if (!currentHash) throw new AppError("User not found", 404);

  const ok = await compare(currentPassword, currentHash);
  if (!ok) throw new AppError("Неверный текущий пароль", 401);

  const newHash = await hash(newPassword, 12);
  await updateUserPasswordHash(pool, userId, newHash);

  logger.info({ userId }, "changePassword: password updated");
}

export async function deleteAccount(userId: string, currentPassword: string): Promise<void> {
  const pool = getPool();

  const currentHash = await getUserPasswordHash(pool, userId);
  if (!currentHash) throw new AppError("User not found", 404);

  const ok = await compare(currentPassword, currentHash);
  if (!ok) throw new AppError("Неверный пароль", 401);

  await deleteUserCascade(pool, userId);

  logger.info({ userId }, "deleteAccount: account deleted");
}
