"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useUserStore } from "@/shared/store/userStore";
import { getMe } from "@/shared/api/auth.api";

export function Providers({ children }: { children: ReactNode }) {
  const hasHydrated = useUserStore((s) => s.hasHydrated);
  const triedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || triedRef.current) return;
    triedRef.current = true;

    // Cookie accessToken/refreshToken браузер прикрепит автоматически (withCredentials).
    // Если access-cookie валидна — сразу получим профиль; если истекла — axios-интерсептор
    // сходит за refresh; если refresh упал — интерсептор отправит на /login.
    getMe()
      .then((me) => {
        useUserStore.getState().setUserId(me.userId);
      })
      .catch(() => {
        useUserStore.getState().clearUser();
      });
  }, [hasHydrated]);

  return <>{children}</>;
}
