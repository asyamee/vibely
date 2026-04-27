import dotenv from "dotenv";

// Загрузка переменных окружения ДО всего остального
dotenv.config();

import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// Импорт конфигурации
import AppConfig from "./config/app.config.js";
import { getPool, migrate } from "./db/postgres.js";

// Импорт маршрутов
import apiRoutes from "./routes/api.js";

// Импорт middleware
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware.js";

const app = express();
// Переопределяем PORT после загрузки dotenv
const PORT = parseInt(process.env.PORT || "3000");

// Инициализация БД (Postgres) + миграции
const pool = getPool();
migrate(pool).catch((e) => {
  console.error("Postgres migration failed", e);
  process.exit(1);
});

// Middleware
app.use(helmet()); // Защита заголовков
app.use(cors(AppConfig.cors)); // Настройка кросс-доменных запросов
app.use(express.json({ limit: "10mb" })); // Парсинг JSON
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Парсинг cookies

// Rate limiting
const limiter = rateLimit({
  windowMs: AppConfig.rateLimit.windowMs, // 15 минут
  max: AppConfig.rateLimit.max, // ограничение на 100 запросов за окно
});
app.use(limiter);

// Строгий rate limiter для auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // максимум 10 попыток за окно
  skipSuccessfulRequests: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Логирование запросов
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Основные маршруты
app.use("/api", apiRoutes);

// Маршрут для проверки состояния сервера
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0",
  });
});

// Обработка 404
app.use(notFoundHandler);

// Глобальный обработчик ошибок
app.use(errorHandler);

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${AppConfig.env}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

export default app;
