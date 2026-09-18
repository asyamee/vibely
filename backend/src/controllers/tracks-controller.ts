import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response.js";
import { getRandomTracks } from "../services/tracks/index.js";

export const getRandomTracksHandler = async (req: Request, res: Response) => {
  const count = Math.min(50, Math.max(1, Number.parseInt((req.query.count as string) ?? "10", 10)));
  const result = await getRandomTracks(count);
  sendSuccess(res, result);
};
