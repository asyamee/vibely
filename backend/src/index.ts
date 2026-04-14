// Главный файл экспорта для бэкенд приложения
export { default } from "./server.js";
export * from "./server.js";

// Также экспортируем основные компоненты
export { default as app } from "./server.js";
export { default as AppConfig } from "./config/app.config.js";
