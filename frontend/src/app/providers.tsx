"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUserStore } from "@/shared/store/userStore";
import { getMe } from "@/shared/api/auth.api";

const PUBLIC_ROUTES = ["/login", "/register"];

export function Providers({ children }: { children: ReactNode }) {
  const hasHydrated = useUserStore((s) => s.hasHydrated);
  const pathname = usePathname() || "/";
  const triedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || triedRef.current) return;
    if (PUBLIC_ROUTES.includes(pathname)) return;

    triedRef.current = true;

    getMe()
      .then((me) => {
        useUserStore.getState().setUserId(me.userId);
      })
      .catch(() => {
        useUserStore.getState().clearUser();
      });
  }, [hasHydrated, pathname]);

  return <>{children}</>;
}
