import { MainFeedPage } from "@/screens/main-feed/ui/MainFeedPage";
import { serverFetch } from "@/shared/api/server";
import type { INearestUsersResponse } from "@/shared/api/users";
import type { IMeResponse } from "@/shared/api/auth";

export default async function Home() {
  const me = await serverFetch<IMeResponse>("/auth/me");

  const nearest = await serverFetch<INearestUsersResponse>(
    `/users/${me.userId}/nearest?top_k=10`,
    { fallback: { userId: me.userId, neighbors: [] } },
  );

  return (
    <MainFeedPage
      userId={me.userId}
      initialNeighbors={nearest.neighbors}
    />
  );
}
