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
import {
  getProfile,
  updateProfile,
  upsertUserProfile,
  updateUserEmbedding,
} from "../controllers/users-controller.js";
import {
  getFriends,
  sendFriendRequest,
  acceptFriend,
} from "../controllers/friends-controller.js";
import { register, login, refresh, logout, getMe } from "../controllers/auth-controller.js";
import { getRandomTracksHandler } from "../controllers/tracks-controller.js";
import { requireAuth, requireSelf, requireAdmin } from "../middleware/auth.middleware.js";
import {
  getAdminStats,
  startRetrain,
  reloadModel,
  streamRetrainLogs,
} from "../controllers/admin-controller.js";

const router: Router = express.Router();

// Auth маршруты (публичные)
router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/refresh", refresh);
router.post("/auth/logout", logout);
router.get("/auth/me", requireAuth, getMe);

// Плейлист (публичный)
router.get("/playlist/:uuid", playlist_UUID);

// Рейтинги (защищённые)
router.post("/ratings", requireAuth, saveRatings);
router.get("/ratings/export-jsonl", requireAuth, exportTrainingJsonl);

// Экспорт JSONL файлов (защищённый)
router.get("/export-jsonl", requireAuth, exportJsonlToFile);
router.get("/export-jsonl/latest", requireAuth, exportLastJsonlFile);
router.get("/export-jsonl/files", requireAuth, listJsonlFiles);

// Случайные треки из БД (защищённый)
router.get("/tracks/random", requireAuth, getRandomTracksHandler);

// Поиск похожих пользователей (защищённый)
router.get("/users/:userId/nearest", requireAuth, getSimilarUsers);

// Управление профилем (защищённый)
router.get("/users/:userId/profile", requireAuth, getProfile);
router.put("/users/:userId/profile", requireAuth, requireSelf, updateProfile);
router.post("/users/:userId/upsert", requireAuth, requireSelf, upsertUserProfile);
// Embedding обновляется из скрипта переобучения, не требует requireSelf
router.post("/users/:userId/embedding", requireAuth, updateUserEmbedding);

// Система друзей (защищённая)
router.get("/users/:userId/friends", requireAuth, getFriends);
router.post("/users/:userId/friends/request", requireAuth, requireSelf, sendFriendRequest);
router.put("/users/:userId/friends/:friendId/accept", requireAuth, requireSelf, acceptFriend);

// Admin (защищённый + requireAdmin)
router.get("/admin/stats", requireAuth, requireAdmin, getAdminStats);
router.post("/admin/retrain", requireAuth, requireAdmin, startRetrain);
router.post("/admin/reload", requireAuth, requireAdmin, reloadModel);
router.get("/admin/retrain/stream", requireAuth, requireAdmin, streamRetrainLogs);

// Тестовый маршрут
router.get("/test", (req: Request, res: Response) => {
  res.status(200).json({ message: "API is working correctly!" });
});

export default router;
