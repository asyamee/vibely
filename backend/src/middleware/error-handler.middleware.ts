import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/app-error.js";
import { logger } from "../lib/logger.js";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  if (statusCode >= 500) {
    logger.error({ err, method: req.method, url: req.url }, "unhandled error");
  } else {
    logger.warn({ message: err.message, method: req.method, url: req.url }, "expected error");
  }

  const message =
    statusCode < 500 || process.env.NODE_ENV === "development"
      ? err.message
      : "Internal Server Error";

  res.status(statusCode).json({ success: false, error: message });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
};
