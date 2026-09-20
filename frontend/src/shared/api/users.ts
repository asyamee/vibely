import { apiClient } from "./client";
import type { IRatingItem } from "./ratings";

export interface IUserContacts {
  telegram: string | null;
  phone: string | null;
  contactEmail: string | null;
}

export type TFriendshipStatus =
  | "self"
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "accepted";

export interface IUserProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  genres: string[];
  favoriteTracks: Array<{ track_id: number; title: string; artist: string }>;
  friendshipStatus: TFriendshipStatus;
  contacts: IUserContacts | null;
}

export interface IUserNeighbor extends IUserProfile {
  similarity: number;
}

export interface INearestUsersResponse {
  userId: string;
  neighbors: IUserNeighbor[];
}

export interface IUserFriend {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  contacts: IUserContacts;
}

export interface IFriendsResponse {
  userId: string;
  friends: IUserFriend[];
}

export interface IFriendRequestItem {
  userId: string;
  displayName: string | null;
  avatarUrl: string;
  createdAt: string;
}

export interface IFriendRequestsResponse {
  userId: string;
  requests: IFriendRequestItem[];
}

export interface IUserPlaylist {
  playlistUuid: string;
  title: string | null;
  isPrimary: boolean;
  addedAt: string;
}

export interface IUserPlaylistsResponse {
  userId: string;
  playlists: IUserPlaylist[];
}

export async function getProfile(userId: string): Promise<IUserProfile> {
  const response = await apiClient.get<IUserProfile>(`/users/${userId}/profile`);
  return response.data;
}

export interface IUpdateProfilePayload {
  displayName?: string;
  genres?: string[];
  telegram?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
}

export async function updateProfile(
  userId: string,
  payload: IUpdateProfilePayload,
): Promise<IUserProfile> {
  const response = await apiClient.put<IUserProfile>(`/users/${userId}/profile`, payload);
  return response.data;
}

export async function upsertUserProfile(
  userId: string,
  displayName?: string,
  genres?: string[],
): Promise<void> {
  await apiClient.post(`/users/${userId}/upsert`, { displayName, genres });
}

export async function getNearestUsers(userId: string, topK: number = 10): Promise<INearestUsersResponse> {
  const response = await apiClient.get<INearestUsersResponse>(
    `/users/${userId}/nearest?top_k=${topK}`,
  );
  return response.data;
}

export async function getFriends(userId: string): Promise<IFriendsResponse> {
  const response = await apiClient.get<IFriendsResponse>(`/users/${userId}/friends`);
  return response.data;
}

export async function getFriendRequests(userId: string): Promise<IFriendRequestsResponse> {
  const response = await apiClient.get<IFriendRequestsResponse>(`/users/${userId}/friends/requests`);
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

export async function listUserPlaylists(userId: string): Promise<IUserPlaylistsResponse> {
  const response = await apiClient.get<IUserPlaylistsResponse>(`/users/${userId}/playlists`);
  return response.data;
}

export async function addUserPlaylist(
  userId: string,
  body: { playlistUuid: string; title?: string; ratings: IRatingItem[] },
): Promise<void> {
  await apiClient.post(`/users/${userId}/playlists`, body);
}

export async function removeUserPlaylist(userId: string, playlistUuid: string): Promise<void> {
  await apiClient.delete(`/users/${userId}/playlists/${playlistUuid}`);
}
