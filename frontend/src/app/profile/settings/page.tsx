import { ProfileSettingsPage } from "@/screens/profile-settings/ui/ProfileSettingsPage";
import { serverFetch } from "@/shared/api/server";
import type { IUserProfile } from "@/shared/api/users";
import type { IMeResponse } from "@/shared/api/auth";

export default async function ProfileSettings() {
  const me = await serverFetch<IMeResponse>("/auth/me");
  const fallback: IUserProfile = {
    userId: me.userId,
    displayName: null,
    avatarUrl: `https://avatars.yandex.net/get-yapic/${me.userId}/islands-retina-50`,
    genres: [],
    favoriteTracks: [],
    friendshipStatus: "self",
    contacts: { telegram: null, phone: null, contactEmail: null },
  };
  const profile = await serverFetch<IUserProfile>(`/users/${me.userId}/profile`, { fallback });

  return <ProfileSettingsPage userId={me.userId} initialProfile={profile} />;
}
