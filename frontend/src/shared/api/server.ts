import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BACKEND_INTERNAL_URL } from "../config/env";

interface ServerFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  // По умолчанию 401 = redirect на /login. Передай false, если нужна обработка 401 в коде.
  redirectOnUnauthorized?: boolean;
}

export async function serverFetch<T>(
  path: string,
  { body, redirectOnUnauthorized = true, headers, ...init }: ServerFetchOptions = {},
): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const url = `${BACKEND_INTERNAL_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    // Самый частый кейс: BACKEND_INTERNAL_URL недостижим из контейнера web.
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
  return (await res.json()) as T;
}
