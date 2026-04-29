import { MainFeedPage } from "@/screens/main-feed/ui/MainFeedPage";
import { serverFetch } from "@/shared/api/server";
import type { NearestUsersResponse } from "@/shared/api/users.api";
import type { MeResponse } from "@/shared/api/auth.api";

export default async function Home() {
  const me = await serverFetch<MeResponse>("/auth/me");

  const nearest = await serverFetch<NearestUsersResponse>(
    `/users/${me.userId}/nearest?top_k=10`,
  );

  return (
    <MainFeedPage
      userId={me.userId}
      initialNeighbors={nearest.neighbors}
    />
  );
}
