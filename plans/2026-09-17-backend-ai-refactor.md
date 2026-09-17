# Backend & AI Refactor Plan — Vibely

> Дата: 2026-09-17  
> Область: `backend/` + `ai/`  
> Стек: Express 5 + TypeScript + PostgreSQL | FastAPI + PyTorch

---

## Контекст

Аудит выявил три класса проблем в каждом сервисе: безопасность (IDOR, race conditions, непинованный JWT), баги (N+1 запросы, необработанные промисы, отсутствие транзакций), качество кода (дублирование, `as any`, IIFE-антипаттерн). В AI-сервисе дополнительно: критичные гонки состояний при переобучении и O(n) поиск ближайших соседей, не масштабирующийся в продакшн.

---

# BACKEND (`backend/`)

---

## Безопасность

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| BS1 | **IDOR на GET `/users/:userId/profile`** — любой auth-пользователь читает чужой профиль | `src/routes/api.ts:73` | ~~🔴 Критично~~ ℹ️ N/A — контакты скрываются в коде (isSelf \|\| friendship=accepted) |
| BS2 | ✅ **IDOR на POST `/users/:userId/embedding`** — любой auth-пользователь перезаписывает эмбеддинг другого | `src/routes/api.ts:77` | 🔴 Критично |
| BS3 | ✅ **JWT algorithm не запинован** — `jwt.verify(token, secret)` без `{ algorithms: ['HS256'] }` | `src/middleware/auth.middleware.ts:30` | 🔴 Критично |
| BS4 | **Нет валидации входных данных** — все контроллеры используют raw `req.body` без Zod/Joi | все controllers | 🔴 Критично |
| BS5 | **Захардкоженные дефолты секретов** — `JWT_SECRET \|\| "dev-access-secret"` | `src/middleware/auth.middleware.ts:4` | 🟡 Среднее |
| BS6 | **Rate limiting только на /auth** — смена пароля, удаление аккаунта, запросы в друзья без лимитов | `src/routes/api.ts` | 🟡 Среднее |
| BS7 | ✅ **ADMIN_USER_IDS не тримит пробелы** — `"user1, user2"` не матчится | `src/middleware/auth.middleware.ts:46` | 🟢 Низкое |
| BS8 | **Stack traces в dev-режиме** — ошибки возвращают `stack` клиенту | `src/middleware/error-handler.middleware.ts:27` | 🟢 Низкое |

**BS1/BS2 fix:** добавить `requireSelf` в `api.ts` на оба роута.  
**BS3 fix:** `jwt.verify(token, secret, { algorithms: ['HS256'] })` в трёх местах.  
**BS4 fix:** подключить Zod, вынести схемы в `src/schemas/`, сделать `validateBody(schema)` middleware.

---

## Баги

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| BB1 | ✅ **N+1 запросы при сохранении оценок** — 300+ DB calls на 100 треков (getOrCreate в цикле) | `src/controllers/ratings-controller.ts:86–100` | 🔴 Критично |
| BB2 | **Отсутствие null-check после DB-запросов** — `res.rows[0]` без проверки длины → crash | `src/db/postgres.ts:138,149,155` | 🟡 Среднее |
| BB3 | ⚠️ **Двойной response в IIFE-pattern** — при ошибке после `res.json()` срабатывает второй `.catch` | `src/controllers/ratings-controller.ts` ✅, `similar-users-controller.ts`, `tracks-controller.ts` | 🟡 Среднее |
| BB4 | **Race condition при обновлении эмбеддинга** — `computeAndSaveEmbedding` fire-and-forget без await | `src/controllers/playlists-controller.ts:119`, `ratings-controller.ts:116` | 🟡 Среднее |
| BB5 | **Нет валидации targetUserId в friend request** — можно отправить заявку несуществующему юзеру | `src/controllers/friends-controller.ts:45–64` | 🟡 Среднее |
| BB6 | **Нет пагинации на getUserFriends** — полный скан при большом числе друзей | `src/db/postgres.ts:635–667` | 🟢 Низкое |
| BB7 | **getOrCreate для artists не использует ON CONFLICT** — два запроса вместо одного | `src/db/postgres.ts:141–156` | 🟢 Низкое |

**BB1 fix:** batch upsert через `UNNEST` или временную таблицу вместо цикла.  
**BB3 fix:** переписать на прямые `async` handlers — Express 5 поддерживает без обёртки.

---

## Код и архитектура

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| BQ1 | **Дублирование `starsToRating()`** — одинаковая функция в ratings и playlists контроллерах | `ratings-controller.ts:32`, `playlists-controller.ts:28` | 🟡 Среднее |
| BQ2 | **`as any` на PoolClient/Pool** — type mismatch обходится кастом | `auth-controller.ts:99,112`, `ratings-controller.ts:81` | 🟡 Среднее |
| BQ3 | **Дублирование `pickParam()` в трёх контроллерах** — одна строка, 3 копии | `users-controller.ts:18`, `friends-controller.ts:12`, `playlists-controller.ts:15` | 🟡 Среднее |
| BQ4 | **`console.log` вместо структурированного логгера** — шум в production, нет уровней | `server.ts:75`, `embedding-service.ts:14`, `jsonl-export-controller.ts:36` | 🟡 Среднее |
| BQ5 | **Inconsistent response envelope** — одни ручки возвращают `{ success }`, другие `{ message }`, третьи данные напрямую | все controllers | 🟡 Среднее |
| BQ6 | **Нет service layer** — контроллеры обращаются к БД напрямую через функции из postgres.ts | все controllers | 🟢 Низкое |
| BQ7 | **Валидация внешних API-ответов отсутствует** — Yandex Music и AI сервис не валидируются | `get-playlists-by-uuid.ts:22`, `embedding-service.ts:31` | 🟢 Низкое |

---

## База данных / индексы

| # | Проблема | Приоритет |
|---|----------|-----------|
| BD1 | ✅ **Нет индекса на `users.email`** — используется в WHERE при каждом login/register | 🔴 Критично |
| BD2 | ✅ **Нет индексов на `friendships(user_id_a)` и `friendships(user_id_b)`** — full scan при списке друзей | 🟡 Среднее |
| BD3 | ✅ **Нет индекса на `user_playlists(user_id)`** — full scan при загрузке плейлистов пользователя | 🟡 Среднее |
| BD4 | ✅ **Нет индекса на `user_genres(user_id)`** — используется при получении профиля | 🟢 Низкое |

**Миграция для всех индексов:**
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_friendships_a ON friendships(user_id_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships(user_id_b);
CREATE INDEX IF NOT EXISTS idx_user_playlists_user ON user_playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_genres_user ON user_genres(user_id);
```

---

# AI SERVICE (`ai/`)

---

## Безопасность

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| AS1 | ✅ **Admin token: сравнение `!=` вместо constant-time** — timing attack утечка токена | `service.py:178` | 🔴 Критично |
| AS2 | ✅ **Пустой дефолт admin token** — если `AI_ADMIN_TOKEN` не задан, любой запрос проходит проверку как `"" != ""` → False (в текущем коде всё-таки блокирует, но неявно)** | `service.py:36` | 🔴 Критично |
| AS3 | **Нет лимита на размер user history** — клиент может отправить 1M треков → OOM crash | `service.py:299`, `inference.py:29` | 🟡 Среднее |
| AS4 | ✅ **Error messages раскрывают внутренние параметры модели** — vocab sizes утекают в 400-ответах | `service.py:254–267` | 🟡 Среднее |
| AS5 | **Нет версионирования зависимостей** — `requirements.txt` без pin-версий | `requirements.txt` | 🟡 Среднее |
| AS6 | **`requests` используется в retrain.py но отсутствует в requirements.txt** | `retrain.py:16`, `requirements.txt` | 🟢 Низкое |

**AS1 fix:** `hmac.compare_digest(token, AI_ADMIN_TOKEN)`.  
**AS2 fix:** `if not AI_ADMIN_TOKEN: raise RuntimeError(...)` при старте приложения.

---

## Баги / Конкурентность

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| AC1 | ✅ **Race condition: чтение модели во время переобучения без блокировки** — инференс читает `app.state.model` пока retrain его заменяет | `service.py:142–158, 303, 350` | 🔴 Критично |
| AC2 | ✅ **Глобальные `NUM_TRACKS/ARTISTS/GENRES` мутируются без лока** — validate_ids читает их во время retrain-обновления | `service.py:38–40, 143–149, 252` | 🔴 Критично |
| AC3 | ✅ **Race condition: `app.state.user_embeddings` (dict) мутируется при retrain без лока** — concurrent read/write → runtime error | `service.py:244, 330` | 🔴 Критично |
| AC4 | **Device mismatch при пересоздании тензоров** — если GPU отваливается в рантайме | `inference.py:35–49` | 🟡 Среднее |
| AC5 | ✅ **В фоновом retrain логируется только `str(exc)`, без traceback** — невозможно дебажить ошибки | `service.py:234` | 🟡 Среднее |
| AC6 | **Нет retry-логики в retrain.py при запросе к бекенду** — временный сбой бекенда прерывает переобучение | `retrain.py:36` | 🟡 Среднее |

**AC1/AC2/AC3 fix — единый паттерн:**
```python
import threading
_model_lock = threading.RLock()

# Чтение:
with _model_lock:
    model = app.state.model
    num_tracks = NUM_TRACKS

# Запись (retrain):
with _model_lock:
    app.state.model = new_model
    NUM_TRACKS = new_num_tracks
```

---

## Производительность

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| AP1 | **O(n) линейный поиск ближайших соседей** — при 10k+ пользователей каждый запрос >100ms, при 100k — timeout | `nearest_neighbours.py:9–21` | 🔴 Критично |
| AP2 | ✅ **Инференс блокируется при загрузке новой модели с диска** — нет double-buffering | `service.py:142–158` | 🟡 Среднее |
| AP3 | **Нет кэширования эмбеддингов** — пересчёт одного пользователя при каждом запросе | `service.py:338–356` | 🟡 Среднее |
| AP4 | **Нет batch-эндпоинта** — 100 пользователей = 100 HTTP-запросов вместо одного | `service.py` | 🟢 Низкое |

**AP1 fix — краткосрочно:**
```python
# nearest_neighbours.py — заменить sort() на heapq.nlargest: O(n log k) vs O(n log n)
import heapq
return heapq.nlargest(top_k, results, key=lambda x: x[1])
```

**AP1 fix — долгосрочно:** FAISS `IndexFlatIP` или `IndexIVFFlat` для O(log n) поиска по ~1M векторов.

**AP2 fix — double buffering:**
```python
new_model = _build_model_from_disk()   # загружаем в отдельную переменную
with _model_lock:
    app.state.model = new_model        # атомарный своп
```

---

## Качество кода (AI)

| # | Проблема | Файл | Приоритет |
|---|----------|------|-----------|
| AQ1 | **Magic numbers без констант** — `dropout=0.4`, `lr=1e-3`, `patience=3`, `1e-8` по всему коду | `model.py:30`, `train.py:157,244,245` | 🟡 Среднее |
| AQ2 | **`model` параметр без type hint** — `build_user_embedding(model, ...)` без `UserMusicEncoder` | `inference.py:19`, `train.py:88` | 🟡 Среднее |
| AQ3 | **`Event = Dict[str, object]`** — слишком широкий тип, нужен TypedDict | `dataset.py:8` | 🟡 Среднее |
| AQ4 | **Дублирование rating encoding** — threshold логика отдельно в service.py и train.py | `service.py:270`, `train.py:80` | 🟢 Низкое |
| AQ5 | **Непоследовательный стиль импортов** — `try: from .module` везде вместо единого подхода | `service.py:20–29`, `inference.py:7–9` | 🟢 Низкое |

---

# Порядок выполнения

## Этап 0 — Критичная безопасность и данные (1–2 дня)

**Backend:**
- BS1/BS2: `requireSelf` на profile GET и embedding POST
- BS3: pinning JWT algorithm
- BD1: индекс на `users.email`

**AI:**
- AS1: `hmac.compare_digest` для admin token
- AS2: fail-fast при пустом `AI_ADMIN_TOKEN`
- AC1/AC2/AC3: `threading.RLock` на model + globals + embeddings dict

## Этап 1 — Производительность и стабильность (2–3 дня)

**Backend:**
- BB1: batch upsert для оценок (убрать N+1)
- BB3: убрать IIFE-pattern, переписать на async handlers
- BD2/BD3: индексы на friendships и user_playlists

**AI:**
- AP1: `heapq.nlargest` краткосрочно
- AP2: double-buffering при загрузке модели

## Этап 2 — Валидация и надёжность (2–3 дня)

**Backend:**
- BS4: Zod-схемы на все роуты (создать `src/schemas/`)
- BB4: убрать fire-and-forget для embedding computation или документировать eventual consistency
- BB5: валидация targetUserId в friend request

**AI:**
- AS3: ограничение `len(tracks) <= MAX_HISTORY_LENGTH`
- AC5: `logger.exception()` вместо `str(exc)` в retrain
- AC6: retry-логика с backoff в retrain.py

## Этап 3 — Рефакторинг и DX (по мере)

**Backend:**
- BQ1/BQ3: вынести `starsToRating`, `pickParam` в `src/utils/`
- BQ2: починить типы PoolClient/Pool вместо `as any`
- BQ4: заменить `console.log` на Pino/Winston
- BQ5: унифицировать response envelope `{ success, message?, data? }`

**AI:**
- AQ1: вынести гиперпараметры в `HYPERPARAMS` dict/dataclass
- AQ2/AQ3: добавить type hints, TypedDict для Event
- AS5/AS6: запинить версии в requirements.txt, добавить `requests`

---

## Проверка

### Backend
```bash
# После индексов
cd backend && npm run dev
# EXPLAIN ANALYZE на запрос логина — убедиться что используется idx_users_email

# После Zod-схем
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "bad"}' # должно вернуть 400 с описанием ошибки

# После BS1: попытка читать чужой профиль — должно вернуть 403
```

### AI
```bash
# После AC1-AC3: запустить параллельные запросы во время retrain
cd ai && uvicorn service:app --port 8000 &
python retrain.py &
# Одновременно:
for i in $(seq 1 50); do
  curl -s http://localhost:8000/users/test_user/embedding &
done
# Не должно быть RuntimeError или некорректных эмбеддингов

# После AS1: timing test
time curl -H "X-Admin-Token: wrong" http://localhost:8000/admin/stats
time curl -H "X-Admin-Token: wrong2" http://localhost:8000/admin/stats
# Разница в response time должна быть < 1ms
```
