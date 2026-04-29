import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "../api/users.api.js";

interface UserStore {
  userId: string | null;
  profile: UserProfile | null;
  accessToken: string | null;
  hasHydrated: boolean;
  setAuth: (userId: string, token: string) => void;
  setProfile: (p: UserProfile) => void;
  setAccessToken: (token: string | null) => void;
  setUserId: (userId: string | null) => void;
  setHasHydrated: (v: boolean) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      userId: null,
      profile: null,
      accessToken: null,
      hasHydrated: false,
      setAuth: (userId, token) => set({ userId, accessToken: token }),
      setProfile: (p) => set({ profile: p }),
      setAccessToken: (token) => set({ accessToken: token }),
      setUserId: (userId) => set({ userId }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
      clearUser: () => set({ userId: null, profile: null, accessToken: null }),
    }),
    {
      name: "vibely-user-store",
      partialize: (state) => ({
        userId: state.userId,
        profile: state.profile,
        // accessToken НЕ persisted — только в памяти!
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
