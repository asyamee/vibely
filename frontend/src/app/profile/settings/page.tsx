import { ProfileSettingsPage } from "@/screens/profile-settings/ui/ProfileSettingsPage";
import { safeServerFetch, serverFetch } from "@/shared/api/server";
import type { UserProfile } from "@/shared/api/users.api";
import type { MeResponse } from "@/shared/api/auth.api";

export default async function ProfileSettings() {
  const me = await serverFetch<MeResponse>("/auth/me");
  const fallback: UserProfile = {
    userId: me.userId,
    displayName: null,
    avatarUrl: `https://avatars.yandex.net/get-yapic/${me.userId}/islands-retina-50`,
    genres: [],
    favoriteTracks: [],
    friendshipStatus: "self",
    contacts: { telegram: null, phone: null, contactEmail: null },
  };
  const profile = await safeServerFetch<UserProfile>(`/users/${me.userId}/profile`, fallback);

  return <ProfileSettingsPage userId={me.userId} initialProfile={profile} />;
}
