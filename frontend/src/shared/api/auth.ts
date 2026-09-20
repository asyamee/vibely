import { apiClient } from "./client";

export interface IRegisterDto {
  email: string;
  password: string;
  displayName?: string;
}

export interface ILoginDto {
  email: string;
  password: string;
}

export interface IAuthResponse {
  userId: string;
  email: string;
  displayName: string | null;
  accessToken: string;
}

export async function register(data: IRegisterDto): Promise<IAuthResponse> {
  const response = await apiClient.post<IAuthResponse>("/auth/register", data);
  return response.data;
}

export async function login(data: ILoginDto): Promise<IAuthResponse> {
  const response = await apiClient.post<IAuthResponse>("/auth/login", data);
  return response.data;
}

export async function refresh(): Promise<{ accessToken: string }> {
  const response = await apiClient.post<{ accessToken: string }>("/auth/refresh");
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export interface IMeResponse {
  userId: string;
  email: string;
  displayName: string | null;
}

export async function getMe(): Promise<IMeResponse> {
  const response = await apiClient.get<IMeResponse>("/auth/me");
  return response.data;
}
