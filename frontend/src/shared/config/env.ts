export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000/api";

// Адрес backend для серверных вызовов (внутри Docker-сети / SSR). Если не задан, используем тот же URL.
export const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL || BACKEND_URL;

export const API_TIMEOUT = 30000;
