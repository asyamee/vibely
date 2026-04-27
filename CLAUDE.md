# CLAUDE.md

Этот файл содержит инструкции для Claude Code (claude.ai/code) при работе с данным репозиторием.

## Обзор проекта

Vibely — приложение для профилирования музыкальных вкусов, состоящее из трёх независимых сервисов:

- **`frontend/`** — Next.js 16 / React 19: пользователи оценивают треки из плейлистов Яндекс Музыки
- **`backend/`** — Express 5 + TypeScript: интеграция с Яндекс Музыкой, хранение оценок в PostgreSQL
- **`ai/`** — PyTorch + FastAPI: кодирует музыкальный вкус пользователя в эмбеддинги для поиска похожих

## Требования

- **Node.js 18+** — для frontend и backend
- **PostgreSQL 12+** — локально или через Docker
- **Python 3.9+** с `pip` и `venv` — для AI-сервиса

## Быстрый старт

Рекомендуемый порядок запуска:

1. **Backend** (обязателен для frontend):
   ```bash
   cd backend && npm run dev
   ```

2. **Frontend** (в отдельном терминале):
   ```bash
   cd frontend && npm run dev
   ```
   Открыть http://localhost:3000

3. **AI-сервис** (опционально, для рекомендаций):
   ```bash
   cd ai && python train.py && uvicorn service:app --host 0.0.0.0 --port 8000
   ```

4. **Полный стек через Docker:**
   ```bash
   docker-compose up --build
   ```

## Команды

### Frontend

Требует `frontend/.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001/api
```

```bash
cd frontend
npm run dev       # dev-сервер на http://localhost:3000 (Next.js + Turbopack)
npm run build     # production-сборка
npm run lint      # eslint + проверка типов
```

### Backend

Работает на порту **3001**. Требует `backend/.env`:
```
PORT=3001
ACCESS_TOKEN=<yandex_music_token>
USER_ID=<yandex_user_id>
DATABASE_URL=postgresql://user:pass@localhost:5432/vibely
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
JWT_ACCESS_SECRET=<секрет>
JWT_REFRESH_SECRET=<секрет>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost
AI_SERVICE_URL=http://localhost:8000
AI_ADMIN_TOKEN=<секретный токен для admin-эндпоинтов AI-сервиса>
ADMIN_USER_IDS=<userId1,userId2>   # пусто = любой авторизованный пользователь
```

```bash
cd backend
npm run dev       # компиляция TypeScript + watch dist/server.js
npm run build     # только npx tsc
npm start         # запуск скомпилированного dist/server.js
```

При запуске backend автоматически применяет миграции Postgres.

### AI-сервис

```bash
cd ai

# Первоначальная настройка:
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Обучение:
python train.py                                          # синтетические данные
python train.py --data-path data/user_events.jsonl      # реальные данные из backend

# Запуск FastAPI:
uvicorn service:app --host 0.0.0.0 --port 8000
```

**Переменные окружения AI-сервиса:**
```
AI_DEVICE=cpu                  # или cuda
AI_MODEL_PATH=user_encoder.pt
AI_NUM_TRACKS=500000
AI_NUM_ARTISTS=100000
AI_NUM_GENRES=64
AI_ADMIN_TOKEN=<тот же токен что в backend>
```

`ai/user_encoder.pt` находится в `.gitignore` — веса модели не коммитятся.

### Тесты

Тесты в проекте не настроены. `npm test` в любом сервисе завершится с ошибкой.

## Структура проекта

**Frontend** использует архитектуру FSD (Feature-Sliced Design):

```
frontend/src/
├── app/                          # Next.js App Router (только роутинг)
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                  # → MainFeedPage
│   ├── login/ register/          # публичные страницы (без авторизации)
│   ├── model-train/page.tsx
│   └── profile/
│
├── screens/                      # FSD: компоненты уровня страниц
│   ├── main-feed/ui/MainFeedPage.tsx
│   ├── profile/ui/ProfilePage.tsx
│   ├── profile-settings/ui/ProfileSettingsPage.tsx
│   └── model-train/ui/ModelTrainPage.tsx
│
├── entities/user/                # FSD: бизнес-сущности
├── shared/                       # FSD: общие утилиты
│   ├── api/
│   │   ├── client.ts             # Axios с интерсепторами авторизации
│   │   ├── users.api.ts
│   │   └── ratings.api.ts
│   ├── config/env.ts
│   ├── store/userStore.ts        # Zustand (сохраняет userId + profile, НЕ accessToken)
│   └── ui/                       # переиспользуемые компоненты
│
└── middleware.ts                 # защита роутов: редирект на /login при отсутствии cookie refreshToken
```

## Архитектура

### Аутентификация

JWT с ротацией refresh-токенов:
- **Access token**: короткоживущий (15 мин), передаётся заголовком `Authorization: Bearer`, хранится только в памяти Zustand (не персистируется)
- **Refresh token**: долгоживущий (7 дней), хэш (SHA256) хранится в таблице `refresh_tokens`, передаётся как httpOnly-cookie
- При 401 Axios-интерсептор вызывает `POST /api/auth/refresh`, повторяет исходный запрос или редиректит на `/login`
- `middleware.ts` (Next.js) защищает все роуты кроме `/login` и `/register`, проверяя наличие cookie `refreshToken`
- Middleware `requireSelf` проверяет, что `req.user.userId === req.params.userId`

### Поток данных

1. **Регистрация через оценку плейлиста:**
   - Пользователь открывает `/model-train`
   - Загружает плейлист по UUID → `GET /api/playlist/:uuid`
   - Оценивает основной плейлист (100 треков) и 20 случайных дополнительных (1–5 звёзд)
   - Отправляет оценки → `POST /api/ratings`
   - Backend автоматически создаёт профиль пользователя (upsert в таблицу `users`)

2. **Управление профилем:**
   - Редактирование на `/profile/settings` → `PUT /api/users/:userId/profile`
   - Хранит имя и жанры в `users` и `user_genres`

3. **Поиск друзей:**
   - На главной странице `/` — ближайшие соседи → `GET /api/users/:userId/nearest?top_k=10`
   - Backend возвращает похожих пользователей с аватаром, жанрами и любимыми треками
   - Запрос в друзья → `POST /api/users/:userId/friends/request`
   - Принятие → `PUT /api/users/:userId/friends/:friendId/accept`

4. **Пайплайн обучения (офлайн):**
   - Экспорт оценок: `GET /api/ratings/export-jsonl`
   - Переобучение: `python train.py --data-path data/user_events.jsonl`
   - AI-сервис загружает обновлённые веса и держит векторы в памяти для быстрого поиска

### База данных и миграции

Схема PostgreSQL управляется через авто-миграции при запуске backend:

| Таблица | Назначение |
|---|---|
| `users` | Аккаунты: `user_id`, `email`, `password_hash`, `display_name`, `avatar_url` |
| `refresh_tokens` | Хэши refresh-токенов с временем истечения (для ротации) |
| `user_genres` | Любимые жанры пользователя |
| `user_events` | Оценки: `(user_id, playlist_uuid, track_id, genre_id, artist_ids, rating)` |
| `user_embeddings` | Кэшированные векторы пользователей из AI-сервиса |
| `tracks` | Маппинг внешний Yandex ID → внутренний последовательный ID |
| `artists` | Маппинг внешний Yandex ID → внутренний последовательный ID |
| `genres` | Маппинг внешний Yandex ID → внутренний последовательный ID |
| `friendships` | Связи дружбы: `(user_id_a, user_id_b, status: 'pending'\|'accepted')` |

Сброс БД: `DROP DATABASE vibely;` и перезапуск backend (миграции применятся заново).

### Маппинг ID

Внешние Yandex ID маппятся во внутренние последовательные целые числа — это контракт между backend и AI-моделью. AI-сервис (`service.py`) ведёт собственные маппинги через `_get_or_create_*` хелперы (независимо от маппингов backend), что позволяет масштабировать AI-сервис отдельно.

### Стиль модулей backend

Используются ES modules (`"type": "module"` в package.json). Все импорты должны использовать расширение `.js`, даже для `.ts`-файлов исходников.

## API

**Публичные эндпоинты:**
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh        — использует httpOnly-cookie refreshToken
POST /api/auth/logout
GET  /api/playlist/:uuid      — получить плейлист Яндекс Музыки
GET  /health
```

**Защищённые (requireAuth — Bearer-токен):**
```
GET  /api/auth/me

POST /api/ratings             — сохранить оценки треков
GET  /api/ratings/export-jsonl — экспорт обучающих данных

GET  /api/users/:userId/nearest?top_k=10  — похожие пользователи
GET  /api/users/:userId/profile
PUT  /api/users/:userId/profile           — requireSelf
POST /api/users/:userId/upsert            — requireSelf
POST /api/users/:userId/embedding         — обновить из AI (любой авторизованный)

GET  /api/users/:userId/friends
POST /api/users/:userId/friends/request   — requireSelf
PUT  /api/users/:userId/friends/:friendId/accept — requireSelf

GET  /api/admin/stats                     — requireAdmin: статус модели, счётчики
POST /api/admin/retrain                   — requireAdmin: запустить переобучение
POST /api/admin/reload                    — requireAdmin: перезагрузить веса с диска
GET  /api/admin/retrain/stream            — requireAdmin: SSE-поток логов обучения
```

## AI-сервис API

FastAPI на порту 8000:
```
GET  /health
POST /users/register                      — зарегистрировать пользователя с историей треков
GET  /users/{user_id}/embedding
GET  /users/{user_id}/nearest?top_k=10
POST /compute-embedding                   — используется скриптом переобучения

GET  /admin/stats                         — статус обучения, размеры словарей (X-Admin-Token)
POST /admin/retrain                       — запустить переобучение в фоне  (X-Admin-Token)
POST /admin/reload                        — перезагрузить веса с диска     (X-Admin-Token)
GET  /admin/retrain/stream                — SSE-поток логов обучения       (X-Admin-Token)
```

## Страницы frontend

- **`/`** (`screens/main-feed/`) — лента похожих пользователей
- **`/profile`** (`screens/profile/`) — профиль пользователя + список друзей
- **`/profile/settings`** (`screens/profile-settings/`) — редактирование профиля (React Hook Form + Zod)
- **`/model-train`** (`screens/model-train/`) — оценка треков плейлиста
- **`/admin`** (`screens/admin/`) — управление моделью: запуск переобучения, живые логи, перезагрузка весов; защищён `requireAdmin` на backend

### Фазы ModelTrainPage

Поток оценки: `input → rating_main → rating_extra → done`

- `input` — ввод UUID плейлиста
- `rating_main` — оценка основного плейлиста
- `rating_extra` — оценка дополнительных треков
- `done` — сообщение об успехе, редирект на главную

## Технологии

**Frontend:** Next.js 16, React 19, Zustand, React Hook Form + Zod, Axios, CSS Modules, lucide-react

**Backend:** Express 5, TypeScript (ES modules), PostgreSQL, bcrypt, JWT (jsonwebtoken), helmet, cookie-parser

**AI:** PyTorch, FastAPI, uvicorn

**Инфраструктура:** Docker Compose (сервисы postgres, api, web, ai в сети `vibely-network`)
