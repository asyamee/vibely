import type { Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { sendSuccess } from "../lib/response.js";
import {
  getAdminStats as getAdminStatsService,
  startRetrain as startRetrainService,
  reloadModel as reloadModelService,
  getRetrainStreamUrl,
} from "../services/admin/index.js";

export const getAdminStats = async (req: Request, res: Response) => {
  const data = await getAdminStatsService();
  sendSuccess(res, data);
};

export const startRetrain = async (req: Request, res: Response) => {
  const data = await startRetrainService(req.body);
  sendSuccess(res, data);
};

export const reloadModel = async (req: Request, res: Response) => {
  const data = await reloadModelService();
  sendSuccess(res, data);
};

export const streamRetrainLogs = async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const streamUrl = getRetrainStreamUrl();
  const AI_ADMIN_TOKEN = process.env.AI_ADMIN_TOKEN ?? "";

  try {
    const upstream = await fetch(streamUrl, {
      headers: { "x-admin-token": AI_ADMIN_TOKEN },
    });

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    req.on("close", () => reader.cancel());

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    logger.error({ err }, "streamRetrainLogs: AI service error");
    res.write(`data: ${JSON.stringify({ error: "AI service unavailable" })}\n\n`);
    res.end();
  }
};
