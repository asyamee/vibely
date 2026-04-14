# Vibely Backend

Express-сервер для музыкального приложения Vibely, интегрированный с Yandex Music API.

## Архитектура

```
backend/
├── src/
│   ├── config/           # Конфигурационные файлы
│   │   └── app.config.ts
│   ├── controllers/      # Контроллеры для обработки запросов
│   │   └── yandex-music-controller.ts
│   ├── middleware/       # Пользовательские middleware
│   │   └── error-handler.middleware.ts
│   ├── routes/           # Файлы маршрутов
│   │   ├── api.ts
│   │   └── yandex-music.ts
│   ├── api/              # API-функции для внешних сервисов
│   │   └── get-playlists-by-uuid.ts
│   ├── utils/            # Утилиты (пустая папка)
│   ├── axios-instance.ts # Конфигурация axios для Yandex Music API
│   └── server.ts         # Главный файл сервера
├── dist/                 # Скомпилированные JS-файлы
├── .env                  # Переменные окружения
└── package.json          # Зависимости и скрипты
```

## Установка

```bash
cd backend
npm install
```

## Настройка

Создайте файл `.env` в корне папки `backend`:

```env
ACCESS_TOKEN=ваш_токен_доступа_к_яндекс_музыке
USER_ID=ваш_айди_пользователя
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

## Запуск

### Режим разработки:

```bash
npm run dev
```

### Компиляция TypeScript:

```bash
npm run build
```

### Запуск скомпилированного сервера:

```bash
npm start
```

## API Эндпоинты

- `GET /health` - проверка состояния сервера
- `GET /api/test` - тестовый эндпоинт
- `GET /api/yandex-music/playlists` - получить плейлисты пользователя
- `GET /api/yandex-music/playlist/:uuid` - получить плейлист по UUID

## Особенности

- Используется TypeScript с строгой типизацией
- Встроенная защита от атак (CORS, Helmet, Rate Limiting)
- Централизованная обработка ошибок
- Конфигурация через env-переменные
- Современные возможности ESNext
