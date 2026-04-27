import { apiClient } from "./client";

export interface AdminStats {
  train_status: "idle" | "running" | "done" | "failed";
  registered_users: number;
  num_tracks: number;
  num_artists: number;
  num_genres: number;
  last_log: string | null;
}

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001/api";

export async function getAdminStats(): Promise<AdminStats> {
  const r = await apiClient.get<AdminStats>("/admin/stats");
  return r.data;
}

export async function startRetrain(params: {
  with_export: boolean;
  epochs: number;
  diversity_weight: number;
}): Promise<void> {
  await apiClient.post("/admin/retrain", params);
}

export async function reloadModel(): Promise<{ status: string }> {
  const r = await apiClient.post<{ status: string }>("/admin/reload");
  return r.data;
}
