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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
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
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    console.error("API error:", error.response?.status, error.response?.data);
    return Promise.reject(error);
  },
);
