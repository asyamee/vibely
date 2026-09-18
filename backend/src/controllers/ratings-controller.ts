import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response.js";
import {
  saveRatings as saveRatingsService,
  exportJsonl,
} from "../services/ratings/index.js";

export const saveRatings = async (req: Request, res: Response) => {
  await saveRatingsService(req.user!.userId, req.body);
  sendSuccess(res, { message: "Рейтинги сохранены в Postgres" });
};

export const exportTrainingJsonl = async (req: Request, res: Response) => {
  const jsonl = await exportJsonl();
  res.setHeader("Content-Type", "application/jsonl; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="user_events.jsonl"');
  res.status(200).send(jsonl.length ? `${jsonl}\n` : "");
};
