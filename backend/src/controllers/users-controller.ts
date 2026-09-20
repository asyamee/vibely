import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { pickParam } from "../lib/request.js";
import { sendSuccess } from "../lib/response.js";
import {
  getProfile as getProfileService,
  updateProfile as updateProfileService,
  upsertProfile,
  updateEmbedding,
  changePassword as changePasswordService,
  deleteAccount as deleteAccountService,
} from "../services/users/index.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const ACCESS_COOKIE_NAME = "accessToken";

const clearAuthCookies = (res: Response) => {
  const base = {
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
  res.clearCookie(REFRESH_COOKIE_NAME, base);
  res.clearCookie(ACCESS_COOKIE_NAME, base);
};

export const getProfile = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId обязателен", 400);
  const result = await getProfileService(userId, req.user?.userId);
  sendSuccess(res, result);
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId обязателен", 400);
  const result = await updateProfileService(userId, req.body);
  sendSuccess(res, result);
};

export const upsertUserProfile = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId обязателен", 400);
  await upsertProfile(userId, req.body);
  sendSuccess(res, { success: true });
};

export const updateUserEmbedding = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId обязателен", 400);
  const result = await updateEmbedding(userId, req.body.embedding);
  sendSuccess(res, { userId, ...result });
};

export const changePassword = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId обязателен", 400);
  await changePasswordService(userId, req.body);
  sendSuccess(res, { success: true });
};

export const deleteAccount = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId обязателен", 400);
  await deleteAccountService(userId, req.body.currentPassword);
  clearAuthCookies(res);
  sendSuccess(res, { success: true });
};
