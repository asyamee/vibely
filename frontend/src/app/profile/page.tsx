import { ProfilePage } from "@/screens/profile/ui/ProfilePage";
import { serverFetch } from "@/shared/api/server";
import type { IUserProfile, IFriendsResponse } from "@/shared/api/users";
import type { IMeResponse } from "@/shared/api/auth";

export default async function Profile() {
  const me = await serverFetch<IMeResponse>("/auth/me");

  const fallbackProfile: IUserProfile = {
    userId: me.userId,
    displayName: null,
    avatarUrl: `https://avatars.yandex.net/get-yapic/${me.userId}/islands-retina-50`,
    genres: [],
    favoriteTracks: [],
    friendshipStatus: "self",
    contacts: { telegram: null, phone: null, contactEmail: null },
  };

  const [profile, friendsResponse] = await Promise.all([
    serverFetch<IUserProfile>(`/users/${me.userId}/profile`, { fallback: fallbackProfile }),
    serverFetch<IFriendsResponse>(`/users/${me.userId}/friends`, { fallback: {
      userId: me.userId,
      friends: [],
    } }),
  ]);

  return (
    <ProfilePage
      userId={me.userId}
      initialProfile={profile}
      initialFriends={friendsResponse.friends}
    />
  );
}
