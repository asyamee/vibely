import { createHash, randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { compare } from "bcrypt";
import {
  getPool,
  getUserByEmail,
  saveRefreshToken,
} from "../../db/postgres.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import type { TLoginInput } from "../../schemas/auth.schema.js";
import type { IAuthResult } from "./register.js";

export type { IAuthResult };

const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

export async function loginUser(input: TLoginInput): Promise<IAuthResult> {
  const { email, password } = input;

  const pool = getPool();

  const user = await getUserByEmail(pool, email);
  if (!user || !user.password_hash) {
    logger.warn({ email }, "login failed: user not found");
    throw new AppError("Неверный email или пароль", 401);
  }

  const passwordValid = await compare(password, user.password_hash);
  if (!passwordValid) {
    logger.warn({ email }, "login failed: wrong password");
    throw new AppError("Неверный email или пароль", 401);
  }

  const accessToken = jwt.sign(
    { userId: user.user_id },
    process.env.JWT_ACCESS_SECRET!,
    { algorithm: "HS256", expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as any },
  );

  const rawRefreshToken = randomBytes(64).toString("hex");
  const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
  const refreshExpiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  await saveRefreshToken(pool, tokenHash, user.user_id, refreshExpiresAt);

  logger.info({ userId: user.user_id, email }, "user logged in");

  return {
    userId: user.user_id,
    email,
    displayName: user.display_name,
    accessToken,
    rawRefreshToken,
    refreshExpiresAt,
  };
}
