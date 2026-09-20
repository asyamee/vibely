export function parseApiError(e: unknown, fallback = "Ошибка"): string {
  if (e && typeof e === "object" && "response" in e) {
    const resp = (e as { response?: { data?: { message?: string } } }).response;
    return resp?.data?.message ?? fallback;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}
