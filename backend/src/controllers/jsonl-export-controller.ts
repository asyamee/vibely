import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getPool, exportEventsForTraining } from "../db/postgres.js";

// Получаем директорию файла для правильного построения путей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "..", "data");

// Экспорт данных в JSONL файл
export const exportJsonlToFile = async (req: Request, res: Response) => {
  try {
    // Проверяем, существует ли директория data, если нет - создаем
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Получаем JSONL данные из базы
    const pool = getPool();
    const jsonlContent = await exportEventsForTraining(pool);

    if (!jsonlContent) {
      return res.status(404).json({ message: "Нет данных для экспорта" });
    }

    // Генерируем имя файла с временной меткой
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `user_events_${timestamp}.jsonl`;
    const filepath = path.join(DATA_DIR, filename);

    // Записываем JSONL в файл
    await fs.writeFile(filepath, jsonlContent + "\n");

    console.log(`JSONL файл успешно создан: ${filepath}`);

    // Возвращаем информацию о созданном файле
    res.status(200).json({
      message: "JSONL файл успешно создан",
      filename: filename,
      filepath: filepath,
      recordsCount: jsonlContent
        .split("\n")
        .filter((line) => line.trim() !== "").length,
    });
  } catch (error) {
    console.error("Ошибка при экспорте JSONL:", error);
    res.status(500).json({
      message: "Ошибка при экспорте JSONL",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Экспорт последнего JSONL файла
export const exportLastJsonlFile = async (req: Request, res: Response) => {
  try {
    // Проверяем, существует ли директория data
    try {
      await fs.access(DATA_DIR);
    } catch {
      return res.status(404).json({ message: "Директория data не существует" });
    }

    // Читаем содержимое директории data
    const files = await fs.readdir(DATA_DIR);

    // Фильтруем JSONL файлы и находим самый последний
    const jsonlFiles = files.filter((file) => file.endsWith(".jsonl"));

    if (jsonlFiles.length === 0) {
      return res
        .status(404)
        .json({ message: "JSONL файлы не найдены в директории data" });
    }

    // Сортируем файлы по времени создания (по имени файла, предполагая формат с timestamp)
    const sortedFiles = jsonlFiles.sort().reverse();
    const latestFile = sortedFiles[0];

    if (!latestFile) {
      return res
        .status(404)
        .json({ message: "JSONL файлы не найдены в директории data" });
    }

    const filepath = path.join(DATA_DIR, latestFile);

    // Отправляем файл как attachment
    res.setHeader("Content-Type", "application/jsonl; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${latestFile}"`,
    );

    res.sendFile(filepath, (err) => {
      if (err) {
        console.error("Ошибка при отправке файла:", err);
        res.status(500).json({
          message: "Ошибка при отправке файла",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  } catch (error) {
    console.error("Ошибка при получении последнего JSONL файла:", error);
    res.status(500).json({
      message: "Ошибка при получении последнего JSONL файла",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Получение списка JSONL файлов
export const listJsonlFiles = async (req: Request, res: Response) => {
  try {
    // Проверяем, существует ли директория data
    try {
      await fs.access(DATA_DIR);
    } catch {
      return res.status(404).json({ message: "Директория data не существует" });
    }

    // Читаем содержимое директории data
    const files = await fs.readdir(DATA_DIR);

    // Фильтруем JSONL файлы
    const jsonlFiles = files
      .filter((file) => file.endsWith(".jsonl"))
      .map((file) => {
        const filepath = path.join(DATA_DIR, file);
        return {
          filename: file,
          filepath: filepath,
        };
      });

    res.status(200).json({
      files: jsonlFiles,
      count: jsonlFiles.length,
    });
  } catch (error) {
    console.error("Ошибка при получении списка JSONL файлов:", error);
    res.status(500).json({
      message: "Ошибка при получении списка JSONL файлов",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
