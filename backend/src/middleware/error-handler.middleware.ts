import type { Request, Response, NextFunction } from "express";

// Интерфейс для пользовательской ошибки
interface CustomError extends Error {
  statusCode?: number;
}

/**
 * Middleware для обработки ошибок
 */
export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
  console.error(err.stack);

  // Определение статус-кода ошибки
  const statusCode = err.statusCode || 500;

  // В production скрываем детали неожиданных (5xx) ошибок — они могут содержать
  // имена таблиц, фрагменты SQL и прочую внутреннюю информацию.
  const isExpectedError = err.statusCode !== undefined && err.statusCode < 500;
  const message =
    isExpectedError || process.env.NODE_ENV === "development"
      ? err.message || "Internal Server Error"
      : "Internal Server Error";

  const response = {
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

/**
 * Middleware для обработки 404 ошибок
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};
