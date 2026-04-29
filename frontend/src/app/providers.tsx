"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useUserStore } from "@/shared/store/userStore";
import { refresh, getMe } from "@/shared/api/auth.api";

export function Providers({ children }: { children: ReactNode }) {
  const hasHydrated = useUserStore((s) => s.hasHydrated);
  const accessToken = useUserStore((s) => s.accessToken);
  const triedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || accessToken || triedRef.current) return;
    triedRef.current = true;

    const store = useUserStore.getState();
    refresh()
      .then(async ({ accessToken }) => {
        store.setAccessToken(accessToken);
        try {
          const me = await getMe();
          store.setUserId(me.userId);
        } catch {
          // ignore — userId может быть уже в persisted store
        }
      })
      .catch(() => {
        store.clearUser();
      });
  }, [hasHydrated, accessToken]);

  return <>{children}</>;
}
