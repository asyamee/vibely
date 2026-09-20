import { UserProfilePage } from "@/screens/user-profile/ui/UserProfilePage";
import { serverFetch } from "@/shared/api/server";
import type { IUserProfile } from "@/shared/api/users";
import type { IMeResponse } from "@/shared/api/auth";
import { notFound, redirect } from "next/navigation";

export default async function UserProfileRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const me = await serverFetch<IMeResponse>("/auth/me");

  if (me.userId === userId) {
    redirect("/profile");
  }

  let profile: IUserProfile;
  try {
    profile = await serverFetch<IUserProfile>(`/users/${userId}/profile`);
  } catch {
    notFound();
  }

  return <UserProfilePage me={me.userId} profile={profile} />;
}
