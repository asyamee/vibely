// Конфигурация приложения
export const AppConfig = {
  port: parseInt(process.env.PORT || "3000"),
  host: process.env.HOST || "localhost",
  env: process.env.NODE_ENV || "development",

  // Конфигурация CORS
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  },

  // Конфигурация rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: parseInt(process.env.RATE_LIMIT_MAX || "100"), // ограничение на 100 запросов
  },

  // Конфигурация Yandex Music API
  yandexMusic: {
    accessToken: process.env.ACCESS_TOKEN || "",
    userId: parseInt(process.env.USER_ID || "337071942"),
    baseUrl: "https://api.music.yandex.net",
  },

  // Конфигурация логирования
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

export default AppConfig;
