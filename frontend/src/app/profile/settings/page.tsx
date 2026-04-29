import { ProfileSettingsPage } from "@/screens/profile-settings/ui/ProfileSettingsPage";
import { serverFetch } from "@/shared/api/server";
import type { UserProfile } from "@/shared/api/users.api";
import type { MeResponse } from "@/shared/api/auth.api";

export default async function ProfileSettings() {
  const me = await serverFetch<MeResponse>("/auth/me");
  const profile = await serverFetch<UserProfile>(`/users/${me.userId}/profile`);

  return <ProfileSettingsPage userId={me.userId} initialProfile={profile} />;
}
