import express, { Router } from "express";
import type { Request, Response } from "express";
import { playlist_UUID } from "../controllers/yandex-music-controller.js";
import {
  exportTrainingJsonl,
  saveRatings,
} from "../controllers/ratings-controller.js";
import { getSimilarUsers } from "../controllers/similar-users-controller.js";
import {
  exportJsonlToFile,
  exportLastJsonlFile,
  listJsonlFiles,
} from "../controllers/jsonl-export-controller.js";

const router: Router = express.Router();

// Маршруты для получения плейлистов
router.get("/playlist/:uuid", playlist_UUID);

// Сохранение пользовательских рейтингов для обучения
router.post("/ratings", saveRatings);
router.get("/ratings/export-jsonl", exportTrainingJsonl);

// Экспорт JSONL файлов
router.get("/export-jsonl", exportJsonlToFile);
router.get("/export-jsonl/latest", exportLastJsonlFile);
router.get("/export-jsonl/files", listJsonlFiles);

// Поиск похожих пользователей по эмбеддингам
router.get("/users/:userId/nearest", getSimilarUsers);

// Тестовый маршрут
router.get("/test", (req: Request, res: Response) => {
  res.status(200).json({ message: "API is working correctly!" });
});

export default router;
