import { MyPlaylistsPage } from "@/screens/my-playlists/ui/MyPlaylistsPage";
import { serverFetch } from "@/shared/api/server";
import type { IUserPlaylistsResponse } from "@/shared/api/users";
import type { IMeResponse } from "@/shared/api/auth";

export default async function MyPlaylists() {
  const me = await serverFetch<IMeResponse>("/auth/me");
  const list = await serverFetch<IUserPlaylistsResponse>(
    `/users/${me.userId}/playlists`,
    { fallback: { userId: me.userId, playlists: [] } },
  );
  return <MyPlaylistsPage userId={me.userId} initialPlaylists={list.playlists} />;
}
