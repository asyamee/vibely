# Vibely AI: Музыкальный профилировщик пользователей

Нейросеть на PyTorch, которая кодирует музыкальные предпочтения пользователя в нормализованный вектор фиксированной размерности (embedding). Позволяет находить похожих пользователей по cosine similarity в embedding-пространстве.

**Архитектура:**
- `model.py` — модель `UserMusicEncoder` (embeddings треков, артистов, жанров + MLP слои с dropout)
- `train.py` — обучение с батчами, LR scheduler, validation split, early stopping
- `inference.py` — построение embedding пользователя из его истории
- `nearest_neighbours.py` — поиск ближайших пользователей
- `service.py` — FastAPI сервис для интерфейса с моделью
- `retrain.py` — **одна команда для переобучения**: скачивает данные с бэкенда и обучает модель
- `main.py` — демо-скрипт для синтетических пользователей

---

## Быстрый старт

### 1. Установка

```bash
cd ai
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Обучение на синтетических данных

```bash
python train.py
```

Выведет:
```
Epoch  1/50 | train=0.5831 | val=0.6102 | lr=0.001000
Epoch  5/50 | train=0.3214 | val=0.3587 | lr=0.001000  ★ best
Epoch  9/50 | train=0.2100 | val=0.2310 | lr=0.000500  ★ best
Early stopping at epoch 14. Best val_loss=0.2310
Model saved to user_encoder.pt
```

### 3. Переобучение на реальных данных (одна команда!)

```bash
python retrain.py --backend-url http://localhost:3001 --token <JWT_TOKEN>
```

Внутри:
1. Скачивает события с бэкенда → `data/user_events.jsonl`
2. Обучает модель на новых данных → `user_encoder.pt`
3. **Пересчитывает embeddings** для всех пользователей (отправляет на бэкенд)
4. Выводит лучший val_loss и количество обновлённых embeddings

**Важно:** После переобучения модели старые embeddings в базе становятся невалидными. `retrain.py` автоматически пересчитывает их и отправляет на бэкенд через `POST /api/users/{user_id}/embedding`.

### 4. Запуск API

```bash
uvicorn service:app --host 0.0.0.0 --port 8000
```

Проверить:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

---

## Модель: UserMusicEncoder

**Входные данные:** История прослушиваний пользователя (список треков с рейтингами)

**Выходные данные:** Нормализованный вектор размерности 16

**Архитектура:**
1. **Embedding слои** (разреженные):
   - Track embedding: `num_tracks → 16d`
   - Artist embedding: `num_artists → 8d` (усредняется по артистам)
   - Genre embedding: `num_genres → 6d`

2. **Event MLP** (обработка одного события):
   ```
   [track_vec (16) + artist_vec (8) + genre_vec (6) + rating (1)] → 31d
   Linear(31→32) → ReLU → Dropout(0.1) → Linear(32→16) → 16d event_vec
   ```

3. **Aggregation** (усреднение по событиям):
   ```
   weights[i] = |rating[i]| + 1e-8  # взвешиваем по силе предпочтения
   user_vec = weighted_mean(event_vecs)
   ```

4. **User MLP** (финализация):
   ```
   user_vec → Linear(16→32) → ReLU → Dropout(0.1) → Linear(32→16) → user_vec
   ```

5. **Normalization**: L2-норма → единичный вектор

**Почему эта архитектура:**
- Weighted aggregation позволяет различать сильные и слабые предпочтения
- Dropout предотвращает переобучение на малом датасете
- L2-нормализация даёт fast cosine similarity (просто dot product)
- Компактный размер (16d) — быстрый поиск в памяти

---

## Обучение модели

### Параметры `train.py`

```bash
python train.py \
  --data-path data/user_events.jsonl  # JSONL с событиями (опционально)
  --model-path user_encoder.pt        # Куда сохранить (default: user_encoder.pt)
  --epochs 50                         # Количество эпох (default: 50)
  --steps-per-epoch 200               # Шагов обучения в эпоху (default: 200)
  --batch-size 8                      # Размер батча (default: 8)
  --patience 5                        # Эпох без улучшения для early stopping (default: 5)
  --min-lr 1e-5                       # Минимальный LR для scheduler (default: 1e-5)
  --num-tracks 501                    # Словарь треков (auto-определяется из данных)
  --num-artists 459                   # Словарь артистов
  --num-genres 44                     # Словарь жанров
  --use-gpu                           # Использовать GPU если доступен
```

### Процесс обучения

**Батчевое обучение:**
- За один шаг обрабатывается `batch_size` пользователей (по умолчанию 8)
- BPR loss: `-log_sigmoid(pos_score - neg_score)` — хочет чтобы позитивные события имели выше scores
- Градиент усредняется по батчу → менее шумный сигнал

**Learning Rate Scheduler:**
- `ReduceLROnPlateau`: если val_loss не улучшается 3 эпохи → LR *= 0.5
- Минимум `min_lr` (по умолчанию 1e-5) чтобы не зависнуть

**Train / Val Split (80/20):**
- Если пользователей < 5 → валидируем на тренировочных (иначе нет смысла)
- Val_loss вычисляется на 5% шагов от train_steps

**Early Stopping:**
- Если val_loss не улучшается `patience` эпох → остановиться
- Сохраняется **лучший checkpoint** (когда val_loss был минимален)

### Формат входных данных (JSONL)

```jsonl
{"user_id":"user_1","track_id":1,"genre_id":1,"artist_ids":[1],"rating":1.0}
{"user_id":"user_1","track_id":2,"genre_id":1,"artist_ids":[1],"rating":0.8}
{"user_id":"user_2","track_id":30,"genre_id":3,"artist_ids":[20],"rating":-1.0}
```

**Требования:**
- Одна запись = одно событие рейтинга
- Обязательные поля: `user_id`, `track_id`, `genre_id`, `artist_ids`, `rating`
- `artist_ids` может быть пустым (→ заменяется на `[0]`)
- `rating` нормализуется в `[-1.0, 1.0]`
- Дедупликация: если пользователь оценил одинок трек дважды, берётся последняя оценка

**Фильтрация:**
- Пользователи с < 2 событиями удаляются
- Пользователи без положительных оценок удаляются

### Экспорт данных с бэкенда

```bash
# Экспортировать рейтинги в JSONL (в памяти)
curl -H "Authorization: Bearer <JWT>" http://localhost:3001/api/ratings/export-jsonl > data/user_events.jsonl

# Или использовать retrain.py (скачивает автоматически)
python retrain.py --backend-url http://localhost:3001 --token <JWT>
```

---

## FastAPI Сервис (service.py)

### Запуск

```bash
# Из папки ai
cd ai
uvicorn service:app --host 0.0.0.0 --port 8000

# Или из корня проекта
uvicorn ai.service:app --host 0.0.0.0 --port 8000
```

### Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `AI_MODEL_PATH` | `user_encoder.pt` | Путь к checkpoint с весами модели |
| `AI_DEVICE` | `cuda` или `cpu` | Устройство для инференса |
| `AI_NUM_TRACKS` | Из checkpoint | Размер словаря треков (auto-определяется) |
| `AI_NUM_ARTISTS` | Из checkpoint | Размер словаря артистов |
| `AI_NUM_GENRES` | Из checkpoint | Размер словаря жанров |

**Примечание:** Размеры словарей автоматически определяются из checkpoint. Env-переменные используются как нижний предел.

### Эндпоинты

#### `GET /health`

Health check.

```bash
curl http://localhost:8000/health
```

Ответ:
```json
{"status":"ok"}
```

---

#### `POST /users/register`

Регистрирует пользователя и вычисляет его embedding. Сохраняет в памяти сервиса.

```bash
curl -X POST http://localhost:8000/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "tracks": [
      {"id": 10, "genre_id": 3, "artist_ids": [21, 22], "liked": "strong_like"},
      {"id": 11, "genre_id": 5, "artist_ids": [30], "liked": "neutral"},
      {"id": 12, "genre_id": 1, "artist_ids": [5, 6], "liked": "dislike"}
    ]
  }'
```

**Параметры:**
- `user_id` (str): Уникальный ID пользователя
- `tracks` (array):
  - `id` (int): Внутренний ID трека (0..NUM_TRACKS-1)
  - `genre_id` (int): ID жанра (0..NUM_GENRES-1)
  - `artist_ids` (array of int): Список ID артистов
  - `liked` (str, опционально): `"strong_like"` | `"like"` | `"neutral"` | `"dislike"` | `"strong_dislike"`

**Шкала liked → rating:**
```
"strong_like"    → +1.0
"like"           → +0.7
"neutral" / null → +0.0
"dislike"        → -0.7
"strong_dislike" → -1.0
```

**Ответ:**
```json
{
  "user_id": "user_123",
  "embedding": [0.123, -0.045, 0.078, ..., 0.089]  // 16 чисел
}
```

---

#### `GET /users/{user_id}/embedding`

Получает сохранённый в памяти embedding пользователя (если он был зарегистрирован на этом сервисе).

```bash
curl http://localhost:8000/users/user_123/embedding
```

**Ответ:**
```json
{
  "user_id": "user_123",
  "embedding": [0.123, -0.045, ..., 0.089]
}
```

**Ошибки:**
- `404`: пользователь не найден в памяти (не регистрировался или сервис перезагружен)

---

#### `POST /compute-embedding` ⭐

**Статeless endpoint** для вычисления embedding без сохранения в памяти. Используется бэкенд Vibely.

```bash
curl -X POST http://localhost:8000/compute-embedding \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "tracks": [
      {"id": 10, "genre_id": 3, "artist_ids": [21, 22], "rating": 1.0},
      {"id": 11, "genre_id": 5, "artist_ids": [30], "rating": -0.1}
    ]
  }'
```

**Параметры:**
- `user_id` (str): ID пользователя (для логирования)
- `tracks` (array):
  - `id` (int): ID трека
  - `genre_id` (int): ID жанра
  - `artist_ids` (array of int): Список ID артистов
  - `rating` (float): Числовой рейтинг (-1.0 до 1.0)

**Отличие от `/users/register`:** вместо `"liked"` передаются числовые `rating`, embedding не сохраняется.

**Ответ:**
```json
{
  "user_id": "user_123",
  "embedding": [0.123, -0.045, ..., 0.089]
}
```

---

#### `GET /users/{user_id}/nearest?top_k=10`

Находит Top-K похожих пользователей по cosine similarity к embedding целевого пользователя.

```bash
curl "http://localhost:8000/users/user_123/nearest?top_k=5"
```

**Параметры:**
- `user_id` (path): ID целевого пользователя
- `top_k` (query, опционально): Количество соседей (1..100, по умолчанию 10)

**Ответ:**
```json
{
  "user_id": "user_123",
  "neighbors": [
    {"user_id": "user_42", "similarity": 0.924},
    {"user_id": "user_7", "similarity": 0.883},
    {"user_id": "user_99", "similarity": 0.847}
  ]
}
```

**Примечание:** Сам пользователь в список не включается. Similarity вычисляется как dot product (так как embeddings нормализованы L2).

**Ошибки:**
- `404`: пользователь не найден

---

## Python API

### Использование модели напрямую

```python
import torch
from ai.model import UserMusicEncoder
from ai.inference import build_user_embedding

# Загрузить модель
device = "cpu"
model = UserMusicEncoder(
    num_tracks=501,
    num_artists=459,
    num_genres=44,
).to(device)
model.load_state_dict(torch.load("user_encoder.pt", map_location=device))
model.eval()

# История пользователя
user_history = [
    {"track_id": 10, "genre_id": 3, "artist_ids": [21, 22], "rating": 1.0},
    {"track_id": 11, "genre_id": 5, "artist_ids": [30], "rating": -0.1},
    {"track_id": 12, "genre_id": 1, "artist_ids": [5, 6], "rating": 0.7},
]

# Вычислить embedding
embedding = build_user_embedding(model, user_history, device=device)
print(embedding.shape)  # (16,)
print(embedding)        # [0.123, -0.045, ...]
```

### Cosine Similarity

```python
from ai.nearest_neighbours import cosine_similarity
import numpy as np

vec1 = np.random.randn(16)
vec2 = np.random.randn(16)
sim = cosine_similarity(vec1, vec2)  # float: -1.0 to 1.0
```

---

## Логирование и диагностика

### Log форматы

При запуске сервиса:
```
INFO:vibely-ai:Model loaded: tracks=501, artists=459, genres=44
```

При вычислении embedding:
```
INFO:vibely-ai:Embedding for user_id=user_123 computed in 0.023s
```

При обучении:
```
INFO:vibely-train:Loaded 5 users, 630 events (0 users filtered)
INFO:vibely-train:Train: 4 users | Val: 1 users
INFO:vibely-train:Epoch  1/50 | train=0.5831 | val=0.6102 | lr=0.001000
INFO:vibely-train:Epoch  9/50 | train=0.2100 | val=0.2310 | lr=0.000500  ★ best
INFO:vibely-train:Early stopping at epoch 14. Best val_loss=0.2310
```

### Как понять, что что-то не так

| Симптом | Причина | Решение |
|---|---|---|
| `Model not found at user_encoder.pt` | Checkpoint не существует | `python train.py` |
| Embedding все нули | Модель не обучена (случайные веса) | Обучите модель |
| Валидная история, embedding но 404 в `/users/{id}/nearest` | Пользователь не зарегистрирован в памяти | Вызовите `/users/register` или `/compute-embedding` |
| Сервис очень медленный | Слишком много пользователей в памяти (O(n) поиск) | Переходить на FAISS или pgvector |
| `rating out of range` | Рейтинг > 1.0 или < -1.0 | Нормализуйте в [-1, 1] |

---

## Масштабирование (TODO)

### Текущие ограничения

1. **In-memory хранилище** — все embeddings пользователей хранятся в памяти процесса сервиса
   - Решение: PostgreSQL + pgvector, Redis, Milvus

2. **Linear поиск** O(n) — для каждого запроса ищем все пользователей
   - Решение: FAISS, Annoy, HNSW индексы

3. **Одинаковые размеры embeddings** — нельзя изменить размер без переобучения
   - Решение: поддержка переменных размеров (более сложно)

### Примерные цифры

- **1,000 пользователей** — OK, ~2MB памяти, поиск ~10ms
- **100,000 пользователей** — OK на сервере, ~200MB, поиск ~1s (нужен FAISS)
- **1M+ пользователей** — нужна БД + отдельный сервис поиска

---

## Проблемы и FAQ

**Q: Loss не падает ниже 0.2**

A: С малым количеством пользователей (< 100) модель быстро запоминает данные. Loss < 0.15 с 630 событиями — нереалистично. Сосредоточьтесь на накоплении больше пользователей.

---

**Q: Как часто переобучать модель?**

A: Зависит от частоты новых оценок. Рекомендации:
- < 100 новых событий в день → раз в неделю
- > 1000 событий в день → раз в день или с использованием incremental learning

---

**Q: Что если номера track_id не последовательные?**

A: Используйте маппинг. Например:
```python
external_to_internal = {
    123456: 0,  # внешний ID 123456 → внутренний 0
    789012: 1,
    ...
}
internal_id = external_to_internal[external_id]
```

Бэкенд Vibely делает это в таблицах `tracks`, `artists`, `genres`.

---

**Q: Можно ли использовать GPU?**

A: Да, установите:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

Затем:
```bash
AI_DEVICE=cuda uvicorn service:app --port 8000
python train.py --use-gpu
```

---

## Интеграция с бэкенд Vibely

### Полный flow

1. **Пользователь оценивает плейлист** → `POST /api/ratings` на бэкенде
2. **Бэкенд сохраняет в `user_events`** и вызывает:
   ```
   POST http://localhost:8000/compute-embedding
   ```
3. **AI-сервис вычисляет embedding** и возвращает вектор
4. **Бэкенд сохраняет в `user_embeddings`** в PostgreSQL
5. **Фронтенд запрашивает** → `GET /api/users/:userId/nearest`
6. **Бэкенд находит похожих** через cosine similarity в SQL

### Переобучение модели

Регулярно (скажем, раз в день):
```bash
python retrain.py \
  --backend-url http://localhost:3001 \
  --token <JWT_TOKEN> \
  --epochs 30
```

Скрипт **автоматически**:
1. Скачивает события с бэкенда
2. Обучает модель на новых данных
3. **Пересчитывает embeddings для всех пользователей**
4. Отправляет обновлённые embeddings на бэкенд через `POST /api/users/:userId/embedding`

Затем перезагрузить AI-сервис:
```bash
# Убить старый процесс uvicorn
# Запустить новый с обновлённым checkpoint
uvicorn ai.service:app --host 0.0.0.0 --port 8000
```

**Важно:** Embeddings пересчитываются сразу после обучения, не требуется ручное действие. Все embeddings в базе обновляются автоматически.

---

## Литература и ссылки

- BPR Loss: [Steffen Rendle et al.](https://arxiv.org/abs/1205.2618)
- Cosine Similarity: [Wikipedia](https://en.wikipedia.org/wiki/Cosine_similarity)
- PyTorch Embeddings: [Docs](https://pytorch.org/docs/stable/generated/torch.nn.Embedding.html)
- FastAPI: [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/)

---

**Версия документации:** 2.0 (Апрель 2026)

**Последние обновления:**
- Батчевое обучение с scheduler и early stopping
- Статeless `/compute-embedding` endpoint
- Одна команда `retrain.py` для переобучения
- Логирование и диагностика
