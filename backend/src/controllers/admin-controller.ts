import type { Request, Response } from "express";
import { exportEventsForTraining, getPool } from "../db/postgres.js";

const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_ADMIN_TOKEN = process.env.AI_ADMIN_TOKEN ?? "";

const adminHeaders = { "x-admin-token": AI_ADMIN_TOKEN };

export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const upstream = await fetch(`${AI_URL}/admin/stats`, { headers: adminHeaders });
    res.status(upstream.status).json(await upstream.json());
  } catch {
    res.status(502).json({ message: "AI service unavailable" });
  }
};

export const startRetrain = async (req: Request, res: Response): Promise<void> => {
  const { with_export = false, epochs = 50, diversity_weight = 0.1 } = req.body as {
    with_export?: boolean;
    epochs?: number;
    diversity_weight?: number;
  };

  try {
    let events_jsonl: string | null = null;

    if (with_export) {
      const pool = getPool();
      events_jsonl = await exportEventsForTraining(pool);
    }

    const upstream = await fetch(`${AI_URL}/admin/retrain`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ events_jsonl, epochs, diversity_weight }),
    });

    res.status(upstream.status).json(await upstream.json());
  } catch (err) {
    console.error("Admin retrain error:", err);
    res.status(502).json({ message: "AI service unavailable" });
  }
};

export const reloadModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const upstream = await fetch(`${AI_URL}/admin/reload`, {
      method: "POST",
      headers: adminHeaders,
    });
    res.status(upstream.status).json(await upstream.json());
  } catch {
    res.status(502).json({ message: "AI service unavailable" });
  }
};

export const streamRetrainLogs = async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const upstream = await fetch(`${AI_URL}/admin/retrain/stream`, {
      headers: adminHeaders,
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
  } catch {
    res.write(`data: ${JSON.stringify({ error: "AI service unavailable" })}\n\n`);
    res.end();
  }
};
