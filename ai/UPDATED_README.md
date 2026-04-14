# Обновленные инструкции для запуска модели

## Проблема

При запуске обучения модели с реальными данными может возникнуть ошибка:

```
IndexError: index out of range in self
```

Это происходит, когда в данных встречаются ID (например, genre_id), которые превышают размеры embedding слоев, заданные при инициализации модели.

## Решение

Мы внесли следующие изменения в код:

### 1. Безопасная обработка индексов (ai/model.py)

Добавлен класс `SafeEmbedding`, который обрабатывает индексы, выходящие за пределы диапазона, с помощью операции `torch.clamp()`:

```python
class SafeEmbedding(nn.Module):
    """Обертка для Embedding, которая безопасно обрабатывает индексы за пределами диапазона."""

    def __init__(self, num_embeddings: int, embedding_dim: int):
        super().__init__()
        self.num_embeddings = num_embeddings
        self.embedding_layer = nn.Embedding(num_embeddings, embedding_dim)

    def forward(self, indices: torch.Tensor) -> torch.Tensor:
        # Обрезаем индексы, чтобы они не выходили за пределы
        safe_indices = torch.clamp(indices, 0, self.num_embeddings - 1)
        return self.embedding_layer(safe_indices)
```

### 2. Автоматическое определение размеров (ai/train.py)

Функция `get_max_ids_from_events()` анализирует данные и автоматически определяет необходимые размеры embedding для всех типов ID:

```python
def get_max_ids_from_events(events):
    """Определяет максимальные ID из событий для корректной инициализации модели."""
    max_track_id = 0
    max_artist_id = 0
    max_genre_id = 0

    for event in events:
        max_track_id = max(max_track_id, event['track_id'])
        max_genre_id = max(max_genre_id, event['genre_id'])
        for artist_id in event['artist_ids']:
            max_artist_id = max(max_artist_id, artist_id)

    # Добавляем запас в 10% для будущих данных
    buffer = 0.1
    return (
        max(100, int(max_track_id * (1 + buffer)) + 1),  # Минимум 100 для треков
        max(100, int(max_artist_id * (1 + buffer)) + 1), # Минимум 100 для артистов
        max(100, int(max_genre_id * (1 + buffer)) + 1)  # Минимум 100 для жанров
    )
```

### 3. Обновленный сервис (ai/service.py)

Сервис теперь может автоматически определять размеры модели из файла весов и корректно инициализировать модель с правильными размерами embedding для всех типов ID.

### 3. Обновленная загрузка модели (ai/service.py)

Сервис теперь может автоматически определять размеры модели из файла весов и корректно инициализировать модель.

## Как запустить обучение

1. Убедитесь, что у вас есть JSONL файл с данными (например, `data/user_events.jsonl`)

2. Запустите обучение с автоматическим определением размеров:

```bash
cd ai
python train.py --data-path data/user_events.jsonl --model-path user_encoder_prod.pt
```

3. Если вы хотите явно задать размеры, используйте параметры:

```bash
python train.py --data-path data/user_events.jsonl --model-path user_encoder_prod.pt \
  --num-tracks 1000 --num-artists 500 --num-genres 400
```

## Запуск сервиса

После обучения вы можете запустить AI-сервис:

```bash
cd ai
AI_MODEL_PATH=user_encoder_prod.pt uvicorn service:app --reload
```

## Важные замечания

- Новые модели используют безопасную обработку индексов, поэтому даже если в данных будут ID, превышающие ожидаемые, модель не упадет с ошибкой
- При работе с новыми данными рекомендуется использовать параметры, которые немного больше максимальных ID в ваших данных (с запасом)
- Размеры embedding можно настраивать через переменные окружения: `AI_NUM_TRACKS`, `AI_NUM_ARTISTS`, `AI_NUM_GENRES`
