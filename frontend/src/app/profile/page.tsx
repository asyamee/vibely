import { ProfilePage } from "@/screens/profile/ui/ProfilePage";
import { serverFetch } from "@/shared/api/server";
import type { UserProfile, FriendsResponse } from "@/shared/api/users.api";
import type { MeResponse } from "@/shared/api/auth.api";

export default async function Profile() {
  const me = await serverFetch<MeResponse>("/auth/me");

  const [profile, friendsResponse] = await Promise.all([
    serverFetch<UserProfile>(`/users/${me.userId}/profile`),
    serverFetch<FriendsResponse>(`/users/${me.userId}/friends`),
  ]);

  return (
    <ProfilePage
      userId={me.userId}
      initialProfile={profile}
      initialFriends={friendsResponse.friends}
    />
  );
}
