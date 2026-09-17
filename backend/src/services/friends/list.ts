import { getPendingFriendRequests, getPool, getUserFriends } from "../../db/postgres.js";
import { defaultAvatar } from "../../lib/request.js";

export interface IFriendItem {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  contacts: {
    telegram: string | null;
    phone: string | null;
    contactEmail: string | null;
  };
}

export interface IFriendListResult {
  userId: string;
  friends: IFriendItem[];
}

export interface IPendingRequest {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  createdAt: string;
}

export async function getFriends(
  userId: string,
  limit?: number,
  offset?: number,
): Promise<IFriendListResult> {
  const pool = getPool();
  // BB6: pass limit/offset — DB function will use them once Task 8 updates the signature
  const friends = await getUserFriends(pool, userId);

  const sliced = limit !== undefined || offset !== undefined
    ? friends.slice(offset ?? 0, limit !== undefined ? (offset ?? 0) + limit : undefined)
    : friends;

  return {
    userId,
    friends: sliced.map((f) => ({
      userId: f.user_id,
      displayName: f.display_name ?? null,
      avatarUrl: f.avatar_url ?? defaultAvatar(f.user_id),
      contacts: {
        telegram: f.telegram ?? null,
        phone: f.phone ?? null,
        contactEmail: f.contact_email ?? null,
      },
    })),
  };
}

export async function listPendingRequests(userId: string): Promise<IPendingRequest[]> {
  const pool = getPool();
  const pending = await getPendingFriendRequests(pool, userId);

  return pending.map((p) => ({
    userId: p.user_id,
    displayName: p.display_name ?? null,
    avatarUrl: p.avatar_url ?? defaultAvatar(p.user_id),
    createdAt: p.created_at,
  }));
}
