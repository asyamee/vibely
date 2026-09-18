import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { sendSuccess } from "../lib/response.js";
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getMe as getMeService,
} from "../services/auth/index.js";

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
  res.clearCookie(REFRESH_COOKIE_NAME, { ...base, path: "/api/auth" });
};

export const register = async (req: Request, res: Response) => {
  const result = await registerUser(req.body);
  res.cookie(REFRESH_COOKIE_NAME, result.rawRefreshToken, buildRefreshCookieOptions(result.refreshExpiresAt));
  res.cookie(ACCESS_COOKIE_NAME, result.accessToken, buildAccessCookieOptions());
  sendSuccess(res, {
    userId: result.userId,
    email: result.email,
    displayName: result.displayName,
    accessToken: result.accessToken,
  }, 201);
};

export const login = async (req: Request, res: Response) => {
  const result = await loginUser(req.body);
  res.cookie(REFRESH_COOKIE_NAME, result.rawRefreshToken, buildRefreshCookieOptions(result.refreshExpiresAt));
  res.cookie(ACCESS_COOKIE_NAME, result.accessToken, buildAccessCookieOptions());
  sendSuccess(res, {
    userId: result.userId,
    email: result.email,
    displayName: result.displayName,
    accessToken: result.accessToken,
  });
};

export const refresh = async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies.refreshToken as string | undefined;
  if (!rawRefreshToken) throw new AppError("Refresh token not found", 401);
  const result = await refreshToken(rawRefreshToken);
  res.cookie(REFRESH_COOKIE_NAME, result.rawRefreshToken, buildRefreshCookieOptions(result.refreshExpiresAt));
  res.cookie(ACCESS_COOKIE_NAME, result.accessToken, buildAccessCookieOptions());
  sendSuccess(res, { accessToken: result.accessToken });
};

export const logout = async (req: Request, res: Response) => {
  await logoutUser(req.cookies.refreshToken as string | undefined);
  clearAuthCookies(res);
  sendSuccess(res, { success: true });
};

export const getMe = async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await getMeService(userId);
  sendSuccess(res, result);
};
