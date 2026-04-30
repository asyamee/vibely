import { NotificationsPage } from "@/screens/notifications/ui/NotificationsPage";
import { safeServerFetch, serverFetch } from "@/shared/api/server";
import type { FriendRequestsResponse } from "@/shared/api/users.api";
import type { MeResponse } from "@/shared/api/auth.api";

export default async function Notifications() {
  const me = await serverFetch<MeResponse>("/auth/me");
  const requests = await safeServerFetch<FriendRequestsResponse>(
    `/users/${me.userId}/friends/requests`,
    { userId: me.userId, requests: [] },
  );

  return <NotificationsPage me={me.userId} initialRequests={requests.requests} />;
}
