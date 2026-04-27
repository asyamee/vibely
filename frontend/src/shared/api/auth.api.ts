import { apiClient } from "./client";

export interface RegisterDto {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  displayName: string | null;
  accessToken: string;
}

export async function register(data: RegisterDto): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/register", data);
  return response.data;
}

export async function login(data: LoginDto): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/login", data);
  return response.data;
}

export async function refresh(): Promise<{ accessToken: string }> {
  const response = await apiClient.post<{ accessToken: string }>("/auth/refresh");
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function getMe(): Promise<any> {
  const response = await apiClient.get("/auth/me");
  return response.data;
}
