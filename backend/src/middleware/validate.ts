import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod/v4";
import { logger } from "../lib/logger.js";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      logger.warn({ path: req.path, errors: result.error.flatten() }, "Request body validation failed");
      res.status(400).json({ success: false, error: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      logger.warn({ path: req.path, errors: result.error.flatten() }, "Request query validation failed");
      res.status(400).json({ success: false, error: result.error.flatten() });
      return;
    }
    // Express 5: req.query — read-only getter, перезаписывать нельзя.
    // Валидация проверяет формат; контроллеры читают req.query напрямую.
    next();
  };
}
