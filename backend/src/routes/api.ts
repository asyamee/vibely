import express, { Router } from "express";
import rateLimit from "express-rate-limit";
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
  changePassword,
  deleteAccount,
  getProfile,
  updateProfile,
  upsertUserProfile,
  updateUserEmbedding,
} from "../controllers/users-controller.js";
import {
  acceptFriend,
  getFriends,
  listPendingRequests,
  rejectFriend,
  removeFriend,
  sendFriendRequest,
} from "../controllers/friends-controller.js";
import {
  addPlaylist,
  listMyPlaylists,
  removePlaylist,
} from "../controllers/playlists-controller.js";
import { register, login, refresh, logout, getMe } from "../controllers/auth-controller.js";
import { getRandomTracksHandler } from "../controllers/tracks-controller.js";
import { requireAuth, requireSelf, requireAdmin } from "../middleware/auth.middleware.js";
import {
  getAdminStats,
  startRetrain,
  reloadModel,
  streamRetrainLogs,
} from "../controllers/admin-controller.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";
import { saveRatingsSchema } from "../schemas/ratings.schema.js";
import {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  updateEmbeddingSchema,
} from "../schemas/users.schema.js";
import { sendFriendRequestSchema } from "../schemas/friends.schema.js";
import { addPlaylistSchema } from "../schemas/playlists.schema.js";
import { startRetrainSchema } from "../schemas/admin.schema.js";
import { topKSchema, countSchema, paginationSchema } from "../schemas/common.schema.js";

const router: Router = express.Router();

// Rate-limiter для чувствительных операций (смена пароля, удаление, запросы в друзья)
const sensitiveLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth маршруты (публичные)
router.post("/auth/register", validateBody(registerSchema), register);
router.post("/auth/login", validateBody(loginSchema), login);
router.post("/auth/refresh", refresh);
router.post("/auth/logout", logout);
router.get("/auth/me", requireAuth, getMe);

// Плейлист (публичный)
router.get("/playlist/:uuid", playlist_UUID);

// Рейтинги (защищённые)
router.post("/ratings", requireAuth, validateBody(saveRatingsSchema), saveRatings);
router.get("/ratings/export-jsonl", requireAuth, exportTrainingJsonl);

// Экспорт JSONL файлов (защищённый)
router.get("/export-jsonl", requireAuth, exportJsonlToFile);
router.get("/export-jsonl/latest", requireAuth, exportLastJsonlFile);
router.get("/export-jsonl/files", requireAuth, listJsonlFiles);

// Случайные треки из БД (защищённый)
router.get("/tracks/random", requireAuth, validateQuery(countSchema), getRandomTracksHandler);

// Поиск похожих пользователей (защищённый)
router.get("/users/:userId/nearest", requireAuth, validateQuery(topKSchema), getSimilarUsers);

// Управление профилем (защищённый)
router.get("/users/:userId/profile", requireAuth, getProfile);
router.put("/users/:userId/profile", requireAuth, requireSelf, validateBody(updateProfileSchema), updateProfile);
router.post("/users/:userId/upsert", requireAuth, requireSelf, upsertUserProfile);
// Embedding обновляется скриптом переобучения от имени admin-пользователя
router.post("/users/:userId/embedding", requireAuth, requireAdmin, validateBody(updateEmbeddingSchema), updateUserEmbedding);

// Безопасность (только владелец)
router.post("/users/:userId/password", requireAuth, requireSelf, sensitiveLimit, validateBody(changePasswordSchema), changePassword);
router.delete("/users/:userId", requireAuth, requireSelf, sensitiveLimit, validateBody(deleteAccountSchema), deleteAccount);

// Система друзей (защищённая)
router.get("/users/:userId/friends", requireAuth, validateQuery(paginationSchema), getFriends);
router.get("/users/:userId/friends/requests", requireAuth, requireSelf, listPendingRequests);
router.post("/users/:userId/friends/request", requireAuth, requireSelf, sensitiveLimit, validateBody(sendFriendRequestSchema), sendFriendRequest);
router.put("/users/:userId/friends/:friendId/accept", requireAuth, requireSelf, acceptFriend);
router.put("/users/:userId/friends/:friendId/reject", requireAuth, requireSelf, rejectFriend);
router.delete("/users/:userId/friends/:friendId", requireAuth, requireSelf, removeFriend);

// Учтённые плейлисты (только владелец)
router.get("/users/:userId/playlists", requireAuth, requireSelf, listMyPlaylists);
router.post("/users/:userId/playlists", requireAuth, requireSelf, validateBody(addPlaylistSchema), addPlaylist);
router.delete("/users/:userId/playlists/:playlistUuid", requireAuth, requireSelf, removePlaylist);

// Admin (защищённый + requireAdmin)
router.get("/admin/stats", requireAuth, requireAdmin, getAdminStats);
router.post("/admin/retrain", requireAuth, requireAdmin, validateBody(startRetrainSchema), startRetrain);
router.post("/admin/reload", requireAuth, requireAdmin, reloadModel);
router.get("/admin/retrain/stream", requireAuth, requireAdmin, streamRetrainLogs);

export default router;
