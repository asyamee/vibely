import { UserProfilePage } from "@/screens/user-profile/ui/UserProfilePage";
import { serverFetch } from "@/shared/api/server";
import type { UserProfile } from "@/shared/api/users.api";
import type { MeResponse } from "@/shared/api/auth.api";
import { notFound, redirect } from "next/navigation";

export default async function UserProfileRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const me = await serverFetch<MeResponse>("/auth/me");

  if (me.userId === userId) {
    redirect("/profile");
  }

  let profile: UserProfile;
  try {
    profile = await serverFetch<UserProfile>(`/users/${userId}/profile`);
  } catch {
    notFound();
  }

  return <UserProfilePage me={me.userId} profile={profile} />;
}
