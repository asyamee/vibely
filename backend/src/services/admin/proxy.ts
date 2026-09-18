import { exportEventsForTraining, getPool } from "../../db/postgres.js";
import { logger } from "../../lib/logger.js";

const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_ADMIN_TOKEN = process.env.AI_ADMIN_TOKEN ?? "";

const adminHeaders = { "x-admin-token": AI_ADMIN_TOKEN };

export function getRetrainStreamUrl(): string {
  return `${AI_URL}/admin/retrain/stream`;
}

export async function getAdminStats(): Promise<object> {
  const upstream = await fetch(`${AI_URL}/admin/stats`, { headers: adminHeaders });
  return upstream.json() as Promise<object>;
}

export interface IRetrainInput {
  with_export?: boolean;
  epochs?: number;
  diversity_weight?: number;
}

export async function startRetrain(input: IRetrainInput): Promise<object> {
  const { with_export = false, epochs = 50, diversity_weight = 0.1 } = input;

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

  logger.info({ epochs, with_export }, "startRetrain dispatched to AI service");

  return upstream.json() as Promise<object>;
}

export async function reloadModel(): Promise<object> {
  const upstream = await fetch(`${AI_URL}/admin/reload`, {
    method: "POST",
    headers: adminHeaders,
  });

  logger.info("reloadModel dispatched to AI service");

  return upstream.json() as Promise<object>;
}
