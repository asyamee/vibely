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

// Доверяем заголовкам X-Forwarded-* от reverse-proxy (nginx/Traefik/Cloud).
// Без этого все запросы за прокси будут считаться одним IP и упрутся в лимит.
app.set("trust proxy", 1);

// Middleware
app.use(helmet()); // Защита заголовков
app.use(cors(AppConfig.cors)); // Настройка кросс-доменных запросов
app.use(express.json({ limit: "10mb" })); // Парсинг JSON
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Парсинг cookies

// Глобальный rate-limiter — щедрый, чтобы SPA с SSR-перезагрузками не утыкался.
const limiter = rateLimit({
  windowMs: AppConfig.rateLimit.windowMs,
  max: AppConfig.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  // Не считаем дешёвые/частые служебные запросы.
  skip: (req) =>
    req.path === "/health" ||
    req.path === "/api/auth/refresh" ||
    req.path === "/api/auth/me",
});
app.use(limiter);

// Строгий rate-limiter только для login/register (защита от брутфорса).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: AppConfig.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
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
