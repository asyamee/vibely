import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3011/api";

interface IServerFetchOptions<F = undefined> extends Omit<RequestInit, "body"> {
  body?: unknown;
  // По умолчанию 401 = redirect на /login. Передай false, если нужна обработка 401 в коде.
  redirectOnUnauthorized?: boolean;
  // Если передан — при ошибке (кроме 401-редиректа) вернёт fallback вместо исключения.
  fallback?: F;
}

export async function serverFetch<T>(
  path: string,
  options?: IServerFetchOptions<T>,
): Promise<T> {
  const { body, redirectOnUnauthorized = true, fallback, headers, ...init } = options ?? {};
  const hasFallback = options !== undefined && "fallback" in options;

  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const accessToken = allCookies.find((c) => c.name === "accessToken")?.value;

    const url = `${BACKEND_INTERNAL_URL}${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch (err) {
      console.error(`[serverFetch] network error on ${url}:`, err);
      throw new Error(
        `Не удалось достучаться до backend (${url}). Проверь BACKEND_INTERNAL_URL.`,
      );
    }

    if (res.status === 401 && redirectOnUnauthorized) {
      redirect("/login");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[serverFetch] ${res.status} on ${url}: ${text}`);
      throw new Error(`Backend ${res.status} on ${path}`);
    }
    if (res.status === 204) return undefined as T;
    const json = await res.json();
    // Backend оборачивает ответы в { success, data } — разворачиваем envelope.
    if (json && typeof json === "object" && "success" in json && "data" in json) {
      return json.data as T;
    }
    return json as T;
  } catch (err) {
    // redirect() бросает специальное исключение — его нельзя глотать.
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    if (hasFallback) {
      console.warn(`[serverFetch] fallback for ${path}:`, (err as Error).message);
      return fallback as T;
    }
    throw err;
  }
}
