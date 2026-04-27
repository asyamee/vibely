"use client";

import { ReactNode, useEffect } from "react";
import { useUserStore } from "@/shared/store/userStore";
import { refresh } from "@/shared/api/auth.api";

export function Providers({ children }: { children: ReactNode }) {
  const { userId, accessToken, setAccessToken, clearUser } = useUserStore();

  useEffect(() => {
    if (userId && !accessToken) {
      refresh()
        .then(({ accessToken }) => setAccessToken(accessToken))
        .catch(() => clearUser());
    }
  }, []);

  return <>{children}</>;
}
