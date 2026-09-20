import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { pickParam } from "../lib/request.js";
import { sendSuccess } from "../lib/response.js";
import {
  listPlaylists,
  addPlaylist as addPlaylistService,
  removePlaylist as removePlaylistService,
} from "../services/playlists/index.js";

export const listMyPlaylists = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId обязателен", 400);
  const playlists = await listPlaylists(userId);
  sendSuccess(res, { userId, playlists });
};

export const addPlaylist = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId обязателен", 400);
  const result = await addPlaylistService(userId, req.body);
  sendSuccess(res, { success: true, playlistUuid: result.playlistUuid });
};

export const removePlaylist = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  const playlistUuid = pickParam(req.params.playlistUuid);
  if (!userId || !playlistUuid) throw new AppError("userId и playlistUuid обязательны", 400);
  await removePlaylistService(userId, playlistUuid);
  sendSuccess(res, { success: true });
};
