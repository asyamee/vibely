import { ProfilePage } from "@/screens/profile/ui/ProfilePage";
import { safeServerFetch, serverFetch } from "@/shared/api/server";
import type { UserProfile, FriendsResponse } from "@/shared/api/users.api";
import type { MeResponse } from "@/shared/api/auth.api";

export default async function Profile() {
  const me = await serverFetch<MeResponse>("/auth/me");

  const fallbackProfile: UserProfile = {
    userId: me.userId,
    displayName: null,
    avatarUrl: `https://avatars.yandex.net/get-yapic/${me.userId}/islands-retina-50`,
    genres: [],
    favoriteTracks: [],
    friendshipStatus: "self",
    contacts: { telegram: null, phone: null, contactEmail: null },
  };

  const [profile, friendsResponse] = await Promise.all([
    safeServerFetch<UserProfile>(`/users/${me.userId}/profile`, fallbackProfile),
    safeServerFetch<FriendsResponse>(`/users/${me.userId}/friends`, {
      userId: me.userId,
      friends: [],
    }),
  ]);

  return (
    <ProfilePage
      userId={me.userId}
      initialProfile={profile}
      initialFriends={friendsResponse.friends}
    />
  );
}
