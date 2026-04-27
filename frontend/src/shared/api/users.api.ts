import { apiClient } from "./client";

export interface UserProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  genres: string[];
  favoriteTracks: Array<{ track_id: number; title: string; artist: string }>;
}

export interface UserNeighbor extends UserProfile {
  similarity: number;
}

export interface NearestUsersResponse {
  userId: string;
  neighbors: UserNeighbor[];
}

export interface UserFriend {
  userId: string;
  displayName: string;
  avatarUrl: string;
}

export interface FriendsResponse {
  userId: string;
  friends: UserFriend[];
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>(`/users/${userId}/profile`);
  return response.data;
}

export async function updateProfile(
  userId: string,
  displayName?: string,
  genres?: string[],
): Promise<UserProfile> {
  const response = await apiClient.put<UserProfile>(`/users/${userId}/profile`, {
    displayName,
    genres,
  });
  return response.data;
}

export async function upsertUserProfile(
  userId: string,
  displayName?: string,
  genres?: string[],
): Promise<void> {
  await apiClient.post(`/users/${userId}/upsert`, {
    displayName,
    genres,
  });
}

export async function getNearestUsers(userId: string, topK: number = 10): Promise<NearestUsersResponse> {
  const response = await apiClient.get<NearestUsersResponse>(
    `/users/${userId}/nearest?top_k=${topK}`,
  );
  return response.data;
}

export async function getFriends(userId: string): Promise<FriendsResponse> {
  const response = await apiClient.get<FriendsResponse>(`/users/${userId}/friends`);
  return response.data;
}

export async function sendFriendRequest(userId: string, targetUserId: string): Promise<void> {
  await apiClient.post(`/users/${userId}/friends/request`, {
    targetUserId,
  });
}

export async function acceptFriendRequest(userId: string, friendId: string): Promise<void> {
  await apiClient.put(`/users/${userId}/friends/${friendId}/accept`);
}
