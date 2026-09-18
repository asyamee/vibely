import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { sendSuccess } from "../lib/response.js";
import {
  exportToFile,
  getLatestFile,
  listFiles,
} from "../services/jsonl-export/index.js";

export const exportJsonlToFile = async (req: Request, res: Response) => {
  const result = await exportToFile();
  sendSuccess(res, {
    message: "JSONL файл успешно создан",
    filename: result.filename,
    filepath: result.filepath,
    recordsCount: result.recordsCount,
  });
};

export const exportLastJsonlFile = async (req: Request, res: Response) => {
  const latest = await getLatestFile();
  if (!latest) {
    throw new AppError("JSONL файлы не найдены в директории data", 404);
  }
  res.setHeader("Content-Type", "application/jsonl; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${latest.filename}"`);
  res.sendFile(latest.filepath);
};

export const listJsonlFiles = async (req: Request, res: Response) => {
  const files = await listFiles();
  sendSuccess(res, { files, count: files.length });
};
