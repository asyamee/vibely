import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

interface TokenPayload {
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.accessToken;
  const token = headerToken || cookieToken;

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as TokenPayload;
    req.user = { userId: payload.userId };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireSelf(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.userId !== req.params.userId) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
}

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(req.user.userId)) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}
