import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { exportEventsForTraining, getPool } from "../../db/postgres.js";
import { logger } from "../../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "..", "..", "data");

export interface IExportResult {
  filename: string;
  filepath: string;
  recordsCount: number;
}

export interface IFileInfo {
  filename: string;
  filepath: string;
}

export async function exportToFile(): Promise<IExportResult> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const pool = getPool();
  const jsonlContent = await exportEventsForTraining(pool);

  if (!jsonlContent) {
    throw new Error("Нет данных для экспорта");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `user_events_${timestamp}.jsonl`;
  const filepath = path.join(DATA_DIR, filename);

  await fs.writeFile(filepath, jsonlContent + "\n");

  logger.info({ filepath }, "JSONL файл успешно создан");

  const recordsCount = jsonlContent
    .split("\n")
    .filter((line) => line.trim() !== "").length;

  return { filename, filepath, recordsCount };
}

export async function getLatestFile(): Promise<{ filepath: string; filename: string } | null> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    return null;
  }

  const files = await fs.readdir(DATA_DIR);
  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl")).sort().reverse();
  const latest = jsonlFiles[0];

  if (!latest) return null;

  return {
    filename: latest,
    filepath: path.join(DATA_DIR, latest),
  };
}

export async function listFiles(): Promise<IFileInfo[]> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    return [];
  }

  const files = await fs.readdir(DATA_DIR);
  return files
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({
      filename: f,
      filepath: path.join(DATA_DIR, f),
    }));
}
