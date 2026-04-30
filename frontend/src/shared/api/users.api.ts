import { apiClient } from "./client";
import type { RatingItem } from "./ratings.api";

export interface UserContacts {
  telegram: string | null;
  phone: string | null;
  contactEmail: string | null;
}

export type FriendshipStatus =
  | "self"
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "accepted";

export interface UserProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  genres: string[];
  favoriteTracks: Array<{ track_id: number; title: string; artist: string }>;
  friendshipStatus: FriendshipStatus;
  contacts: UserContacts | null;
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
  displayName: string | null;
  avatarUrl: string;
  contacts: UserContacts;
}

export interface FriendsResponse {
  userId: string;
  friends: UserFriend[];
}

export interface FriendRequestItem {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  createdAt: string;
}

export interface FriendRequestsResponse {
  userId: string;
  requests: FriendRequestItem[];
}

export interface UserPlaylist {
  playlistUuid: string;
  title: string | null;
  isPrimary: boolean;
  addedAt: string;
}

export interface UserPlaylistsResponse {
  userId: string;
  playlists: UserPlaylist[];
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>(`/users/${userId}/profile`);
  return response.data;
}

export interface UpdateProfilePayload {
  displayName?: string;
  genres?: string[];
  telegram?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
}

export async function updateProfile(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<UserProfile> {
  const response = await apiClient.put<UserProfile>(`/users/${userId}/profile`, payload);
  return response.data;
}

export async function upsertUserProfile(
  userId: string,
  displayName?: string,
  genres?: string[],
): Promise<void> {
  await apiClient.post(`/users/${userId}/upsert`, { displayName, genres });
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

export async function getFriendRequests(userId: string): Promise<FriendRequestsResponse> {
  const response = await apiClient.get<FriendRequestsResponse>(`/users/${userId}/friends/requests`);
  return response.data;
}

export async function sendFriendRequest(userId: string, targetUserId: string): Promise<void> {
  await apiClient.post(`/users/${userId}/friends/request`, { targetUserId });
}

export async function acceptFriendRequest(userId: string, friendId: string): Promise<void> {
  await apiClient.put(`/users/${userId}/friends/${friendId}/accept`);
}

export async function rejectFriendRequest(userId: string, friendId: string): Promise<void> {
  await apiClient.put(`/users/${userId}/friends/${friendId}/reject`);
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}/friends/${friendId}`);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post(`/users/${userId}/password`, { currentPassword, newPassword });
}

export async function deleteAccount(userId: string, currentPassword: string): Promise<void> {
  await apiClient.delete(`/users/${userId}`, { data: { currentPassword } });
}

export async function listUserPlaylists(userId: string): Promise<UserPlaylistsResponse> {
  const response = await apiClient.get<UserPlaylistsResponse>(`/users/${userId}/playlists`);
  return response.data;
}

export async function addUserPlaylist(
  userId: string,
  body: { playlistUuid: string; title?: string; ratings: RatingItem[] },
): Promise<void> {
  await apiClient.post(`/users/${userId}/playlists`, body);
}

export async function removeUserPlaylist(userId: string, playlistUuid: string): Promise<void> {
  await apiClient.delete(`/users/${userId}/playlists/${playlistUuid}`);
}
