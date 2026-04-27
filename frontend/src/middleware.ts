import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Пропускаем публичные маршруты
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Проверяем наличие refreshToken cookie (если логин произошёл, есть refresh token)
  const hasRefreshToken = request.cookies.has("refreshToken");

  // Если нет refresh token, редирект на login
  if (!hasRefreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
