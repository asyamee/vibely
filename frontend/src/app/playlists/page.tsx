import { MyPlaylistsPage } from "@/screens/my-playlists/ui/MyPlaylistsPage";
import { safeServerFetch, serverFetch } from "@/shared/api/server";
import type { UserPlaylistsResponse } from "@/shared/api/users.api";
import type { MeResponse } from "@/shared/api/auth.api";

export default async function MyPlaylists() {
  const me = await serverFetch<MeResponse>("/auth/me");
  const list = await safeServerFetch<UserPlaylistsResponse>(
    `/users/${me.userId}/playlists`,
    { userId: me.userId, playlists: [] },
  );
  return <MyPlaylistsPage userId={me.userId} initialPlaylists={list.playlists} />;
}
