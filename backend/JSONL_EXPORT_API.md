# API для экспорта данных в JSONL

## Описание

Этот API позволяет экспортировать пользовательские рейтинги и события в формате JSONL (JSON Lines), который удобен для машинной обработки и обучения моделей.

## Доступные эндпоинты

### 1. Создание JSONL файла

**GET** `/api/export-jsonl`

Создает новый JSONL файл с данными из базы данных и сохраняет его в директорию `data/`.

#### Ответ:

```json
{
  "message": "JSONL файл успешно создан",
  "filename": "user_events_2023-12-13T08-58-37.123Z.jsonl",
  "filepath": "c:/Users/Dmitry/Desktop/Front/vibely/backend/data/user_events_2023-12-13T08-58-37.123Z.jsonl",
  "recordsCount": 150
}
```

### 2. Получение последнего JSONL файла

**GET** `/api/export-jsonl/latest`

Возвращает последний созданный JSONL файл как загружаемый файл.

#### Ответ:

- HTTP 200: Файл JSONL как attachment
- HTTP 404: Если файлы не найдены

### 3. Получение списка JSONL файлов

**GET** `/api/export-jsonl/files`

Возвращает список всех доступных JSONL файлов в директории `data/`.

#### Ответ:

```json
{
  "files": [
    {
      "filename": "user_events_2023-12-13T08-58-37.123Z.jsonl",
      "filepath": "c:/Users/Dmitry/Desktop/Front/vibely/backend/data/user_events_2023-12-13T08-58-37.123Z.jsonl"
    }
  ],
  "count": 1
}
```

## Примеры использования

### Запуск сервера:

```bash
npm run dev
```

### Создание JSONL файла:

```bash
curl -X GET http://localhost:3000/api/export-jsonl
```

### Скачивание последнего JSONL файла:

```bash
curl -X GET http://localhost:3000/api/export-jsonl/latest -o user_events_latest.jsonl
```

### Получение списка JSONL файлов:

```bash
curl -X GET http://localhost:3000/api/export-jsonl/files
```

### Альтернативный способ экспорта (если сервер запущен):

```bash
npm run export-jsonl
```

## Формат JSONL

Каждая строка в файле содержит один JSON объект с информацией о пользовательском событии:

```json
{"user_id": "123456", "track_id": 108721702, "genre_id": 1, "artist_ids": [123, 456], "rating": 1.0}
{"user_id": "123456", "track_id": 108721703, "genre_id": 2, "artist_ids": [789], "rating": -0.5}
```

Где:

- `user_id`: ID пользователя
- `track_id`: Внутренний ID трека
- `genre_id`: Внутренний ID жанра
- `artist_ids`: Массив внутренних ID артистов
- `rating`: Рейтинг (-1.0 до 1.0, где -1.0 = сильное неприятие, 1.0 = сильное одобрение)
