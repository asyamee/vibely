import axios from "axios";
import { BACKEND_URL, API_TIMEOUT } from "../config/env";
import { useUserStore } from "../store/userStore";

export const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // для cookies
});

// Request interceptor: добавить Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const store = useUserStore.getState();
    if (store.accessToken) {
      config.headers.Authorization = `Bearer ${store.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: обработать 401 и refresh token
let isRefreshing = false;
type QueueItem = {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
};
let failedQueue: QueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const PUBLIC_PATHS = ["/login", "/register"];

const isOnPublicPage = (): boolean => {
  if (typeof window === "undefined") return false;
  return PUBLIC_PATHS.some((p) => window.location.pathname === p);
};

// Запросы, для которых не следует пытаться рефрешить токен и редиректить на /login.
// /auth/login и /auth/register сами по себе возвращают 401 при неверных credentials —
// это бизнес-ошибка, а не истёкшая сессия.
const isAuthEndpoint = (url: string | undefined): boolean => {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/refresh")
  );
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest?.url)
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${BACKEND_URL}/auth/refresh`, undefined, {
          withCredentials: true,
        });
        const { accessToken } = response.data;

        useUserStore.getState().setAccessToken(accessToken);
        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);

        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        useUserStore.getState().clearUser();
        // Не редиректим, если пользователь уже на публичной странице — иначе
        // получаем бесконечный reload-цикл (login → getMe → 401 → refresh fail → /login).
        if (!isOnPublicPage()) {
          window.location.href = "/login";
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    console.error("API error:", error.response?.status, error.response?.data);
    return Promise.reject(error);
  },
);
