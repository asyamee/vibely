import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IUserProfile } from "../api/users.js";

interface IUserStore {
  userId: string | null;
  profile: IUserProfile | null;
  accessToken: string | null;
  hasHydrated: boolean;
  favoritedUserIds: string[];
  setAuth: (userId: string, token: string) => void;
  setProfile: (p: IUserProfile) => void;
  setAccessToken: (token: string | null) => void;
  setUserId: (userId: string | null) => void;
  setHasHydrated: (v: boolean) => void;
  toggleFavorite: (targetUserId: string) => void;
  clearUser: () => void;
}

export const useUserStore = create<IUserStore>()(
  persist(
    (set) => ({
      userId: null,
      profile: null,
      accessToken: null,
      hasHydrated: false,
      favoritedUserIds: [],
      setAuth: (userId, token) => set({ userId, accessToken: token }),
      setProfile: (p) => set({ profile: p }),
      setAccessToken: (token) => set({ accessToken: token }),
      setUserId: (userId) => set({ userId }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
      toggleFavorite: (targetUserId) =>
        set((state) => {
          const exists = state.favoritedUserIds.includes(targetUserId);
          return {
            favoritedUserIds: exists
              ? state.favoritedUserIds.filter((id) => id !== targetUserId)
              : [...state.favoritedUserIds, targetUserId],
          };
        }),
      clearUser: () => set({ userId: null, profile: null, accessToken: null, favoritedUserIds: [] }),
    }),
    {
      name: "vibely-user-store",
      partialize: (state) => ({
        userId: state.userId,
        profile: state.profile,
        favoritedUserIds: state.favoritedUserIds,
        // accessToken НЕ persisted — только в памяти!
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
