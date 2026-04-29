import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register"];

const BACKEND =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001/api";

function getSetCookies(headers: Headers): string[] {
  const fn = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof fn === "function") return fn.call(headers);
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function parseCookieValue(setCookie: string, name: string): string | null {
  const match = setCookie.match(new RegExp(`^${name}=([^;]+)`));
  return match ? match[1] : null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get("refreshToken")?.value;
  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (request.cookies.get("accessToken")) {
    return NextResponse.next();
  }

  // Access истёк/отсутствует — обновляем, чтобы Server Components могли подтянуть данные сразу.
  try {
    const refreshRes = await fetch(`${BACKEND}/auth/refresh`, {
      method: "POST",
      headers: { cookie: `refreshToken=${refreshToken}` },
    });

    if (!refreshRes.ok) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("refreshToken");
      return response;
    }

    const data = (await refreshRes.json().catch(() => null)) as { accessToken?: string } | null;
    const setCookies = getSetCookies(refreshRes.headers);
    const newAccessToken = data?.accessToken ?? null;
    let newRefreshToken: string | null = null;
    for (const sc of setCookies) {
      const r = parseCookieValue(sc, "refreshToken");
      if (r) newRefreshToken = r;
    }

    if (!newAccessToken) {
      // Backend не вернул токен — на всякий случай уходим на логин.
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // КРИТИЧНО: подменяем cookie прямо в текущем входящем запросе, чтобы Server Components
    // в этом же цикле увидели новый accessToken. Иначе serverFetch получит 401 и улетит на /login.
    const cookieParts: string[] = [];
    for (const c of request.cookies.getAll()) {
      if (c.name === "accessToken" || c.name === "refreshToken") continue;
      cookieParts.push(`${c.name}=${c.value}`);
    }
    cookieParts.push(`accessToken=${newAccessToken}`);
    cookieParts.push(`refreshToken=${newRefreshToken ?? refreshToken}`);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("cookie", cookieParts.join("; "));

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    // Set-Cookie из ответа backend пробрасываем в браузер.
    for (const sc of setCookies) {
      response.headers.append("set-cookie", sc);
    }
    return response;
  } catch (err) {
    console.error("[middleware] proactive refresh failed:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
