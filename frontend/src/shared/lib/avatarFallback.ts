import type { SyntheticEvent } from "react";

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' fill='%23555'%3E%3Crect width='120' height='120' rx='16' fill='%23222'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%23666'%3E%3F%3C/text%3E%3C/svg%3E";

export function onAvatarError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src !== FALLBACK_AVATAR) {
    img.src = FALLBACK_AVATAR;
  }
}
