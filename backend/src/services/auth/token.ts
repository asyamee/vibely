import { createHash, randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import {
  getPool,
  getRefreshToken,
  deleteRefreshToken,
  saveRefreshToken,
} from "../../db/postgres.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";

export interface IRefreshResult {
  accessToken: string;
  rawRefreshToken: string;
  refreshExpiresAt: Date;
}

export interface IMeResult {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string;
}

const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

export async function refreshToken(rawToken: string): Promise<IRefreshResult> {
  const pool = getPool();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const tokenRecord = await getRefreshToken(pool, tokenHash);
  if (!tokenRecord) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  await deleteRefreshToken(pool, tokenHash);

  const accessToken = jwt.sign(
    { userId: tokenRecord.user_id },
    process.env.JWT_ACCESS_SECRET!,
    { algorithm: "HS256", expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as any },
  );

  const newRawRefreshToken = randomBytes(64).toString("hex");
  const newTokenHash = createHash("sha256").update(newRawRefreshToken).digest("hex");
  const refreshExpiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  await saveRefreshToken(pool, newTokenHash, tokenRecord.user_id, refreshExpiresAt);

  return { accessToken, rawRefreshToken: newRawRefreshToken, refreshExpiresAt };
}

export async function logoutUser(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;

  const pool = getPool();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await deleteRefreshToken(pool, tokenHash);
  logger.info("user logged out");
}

export async function getMe(userId: string): Promise<IMeResult> {
  const pool = getPool();

  const res = await pool.query<{
    user_id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
  }>(
    `SELECT user_id, email, display_name, avatar_url FROM users WHERE user_id = $1`,
    [userId],
  );

  if (!res.rows.length) {
    throw new AppError("User not found", 404);
  }

  const row = res.rows[0]!;

  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? `https://avatars.yandex.net/get-yapic/${row.user_id}/islands-retina-50`,
  };
}
