import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register"];

const BACKEND =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001/api";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get("refreshToken")?.value;
  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Если access-cookie уже есть, отпускаем дальше — Server Components возьмут токен из неё.
  if (request.cookies.get("accessToken")) {
    return NextResponse.next();
  }

  // Access истёк/отсутствует, но refresh есть — проактивно обновляем, чтобы SSR имел валидный токен.
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

    const response = NextResponse.next();
    const setCookies =
      typeof refreshRes.headers.getSetCookie === "function"
        ? refreshRes.headers.getSetCookie()
        : refreshRes.headers.get("set-cookie")
          ? [refreshRes.headers.get("set-cookie") as string]
          : [];
    for (const sc of setCookies) {
      response.headers.append("set-cookie", sc);
    }
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
