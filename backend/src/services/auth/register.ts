import { createHash, randomBytes } from "crypto";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { hash } from "bcrypt";
import {
  getPool,
  createUser,
  getUserByEmail,
  saveRefreshToken,
  upsertUser,
} from "../../db/postgres.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import type { TRegisterInput } from "../../schemas/auth.schema.js";

export interface IAuthResult {
  userId: string;
  email: string;
  displayName: string | null;
  accessToken: string;
  rawRefreshToken: string;
  refreshExpiresAt: Date;
}

const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

export async function registerUser(input: TRegisterInput): Promise<IAuthResult> {
  const { email, password, displayName } = input;

  const pool = getPool();

  const existing = await getUserByEmail(pool, email);
  if (existing) {
    throw new AppError("Этот email уже зарегистрирован", 409);
  }

  const userId = randomUUID();
  const passwordHash = await hash(password, 12);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await createUser(client, { userId, email, passwordHash, displayName: displayName ?? undefined });
    await upsertUser(client as any, userId, displayName ?? undefined);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_ACCESS_SECRET!,
    { algorithm: "HS256", expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as any },
  );

  const rawRefreshToken = randomBytes(64).toString("hex");
  const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
  const refreshExpiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  await saveRefreshToken(pool, tokenHash, userId, refreshExpiresAt);

  logger.info({ userId, email }, "user registered");

  return {
    userId,
    email,
    displayName: displayName ?? null,
    accessToken,
    rawRefreshToken,
    refreshExpiresAt,
  };
}
