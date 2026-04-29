import type { Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { hash, compare } from "bcrypt";
import { randomUUID } from "crypto";
import {
  getPool,
  createUser,
  getUserByEmail,
  saveRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  upsertUser,
} from "../db/postgres.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

interface TokenPayload {
  userId: string;
}

const REFRESH_COOKIE_NAME = "refreshToken";
const ACCESS_COOKIE_NAME = "accessToken";

const buildRefreshCookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  expires,
  path: "/",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

// Срок жизни access-cookie совпадает с TTL JWT — после истечения интерсептор сходит за refresh.
const ACCESS_COOKIE_TTL_MS = 15 * 60 * 1000;
const buildAccessCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: ACCESS_COOKIE_TTL_MS,
  path: "/",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

const clearAuthCookies = (res: Response) => {
  const base = {
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
  res.clearCookie(REFRESH_COOKIE_NAME, base);
  res.clearCookie(ACCESS_COOKIE_NAME, base);
  // Подчищаем легаси-cookie со старым path="/api/auth"
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...base,
    path: "/api/auth",
  });
};

export const register = async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    const pool = getPool();

    // Проверяем что email не занят
    const existing = await getUserByEmail(pool, email);
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const userId = randomUUID();
    const passwordHash = await hash(password, 12);

    // Создаём пользователя + профиль
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await createUser(client, { userId, email, passwordHash, displayName: displayName || undefined });
      await upsertUser(client as any, userId, displayName || undefined);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    // Выдаём токены
    const accessToken = jwt.sign(
      { userId } as TokenPayload,
      ACCESS_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN } as any,
    );

    const rawRefresh = randomBytes(64).toString("hex");
    const tokenHash = createHash("sha256").update(rawRefresh).digest("hex");
    const refreshExpiresMs =
      7 * 24 * 60 * 60 * 1000; /* 7 дней, зависит от REFRESH_EXPIRES_IN */
    const expiresAt = new Date(Date.now() + refreshExpiresMs);

    await saveRefreshToken(pool, tokenHash, userId, expiresAt);

    res.cookie(REFRESH_COOKIE_NAME, rawRefresh, buildRefreshCookieOptions(expiresAt));
    res.cookie(ACCESS_COOKIE_NAME, accessToken, buildAccessCookieOptions());

    return res.status(201).json({
      userId,
      email,
      displayName: displayName || null,
      accessToken,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const pool = getPool();

    const user = await getUserByEmail(pool, email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordValid = await compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Выдаём токены
    const accessToken = jwt.sign(
      { userId: user.user_id } as TokenPayload,
      ACCESS_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN } as any,
    );

    const rawRefresh = randomBytes(64).toString("hex");
    const tokenHash = createHash("sha256").update(rawRefresh).digest("hex");
    const refreshExpiresMs = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + refreshExpiresMs);

    await saveRefreshToken(pool, tokenHash, user.user_id, expiresAt);

    res.cookie(REFRESH_COOKIE_NAME, rawRefresh, buildRefreshCookieOptions(expiresAt));
    res.cookie(ACCESS_COOKIE_NAME, accessToken, buildAccessCookieOptions());

    return res.status(200).json({
      userId: user.user_id,
      email,
      displayName: user.display_name,
      accessToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies.refreshToken;

  if (!rawRefreshToken) {
    return res.status(401).json({ message: "Refresh token not found" });
  }

  try {
    const pool = getPool();
    const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");

    const tokenRecord = await getRefreshToken(pool, tokenHash);
    if (!tokenRecord) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    // Инвалидируем старый токен и выдаём новый (ротация)
    await deleteRefreshToken(pool, tokenHash);

    const accessToken = jwt.sign(
      { userId: tokenRecord.user_id } as TokenPayload,
      ACCESS_SECRET,
      { expiresIn: ACCESS_EXPIRES_IN } as any,
    );

    const newRawRefresh = randomBytes(64).toString("hex");
    const newTokenHash = createHash("sha256").update(newRawRefresh).digest("hex");
    const refreshExpiresMs = 7 * 24 * 60 * 60 * 1000;
    const newExpiresAt = new Date(Date.now() + refreshExpiresMs);

    await saveRefreshToken(pool, newTokenHash, tokenRecord.user_id, newExpiresAt);

    res.cookie(REFRESH_COOKIE_NAME, newRawRefresh, buildRefreshCookieOptions(newExpiresAt));
    res.cookie(ACCESS_COOKIE_NAME, accessToken, buildAccessCookieOptions());

    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies.refreshToken;

  if (rawRefreshToken) {
    try {
      const pool = getPool();
      const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
      await deleteRefreshToken(pool, tokenHash);
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  clearAuthCookies(res);
  return res.status(200).json({ success: true });
};

export const getMe = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const pool = getPool();
    const user = await pool.query(
      `SELECT user_id, email, display_name, avatar_url FROM users WHERE user_id = $1`,
      [userId],
    );

    if (!user.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const row = user.rows[0];
    return res.status(200).json({
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl:
        row.avatar_url || `https://avatars.yandex.net/get-yapic/${row.user_id}/islands-retina-50`,
    });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
