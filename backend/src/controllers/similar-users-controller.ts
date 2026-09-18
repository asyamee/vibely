import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { pickParam } from "../lib/request.js";
import { sendSuccess } from "../lib/response.js";
import { findSimilarUsers } from "../services/similar-users/index.js";

export const getSimilarUsers = async (req: Request, res: Response) => {
  const userId = pickParam(req.params.userId);
  if (!userId) throw new AppError("userId is required", 400);
  const topK = Math.min(
    100,
    Math.max(1, Number.parseInt((req.query.top_k as string) ?? "10", 10)),
  );
  const result = await findSimilarUsers(userId, topK);
  sendSuccess(res, result);
};
