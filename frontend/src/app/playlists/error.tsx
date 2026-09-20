"use client";

import { ErrorFallback } from "@/shared/ui/ErrorFallback/ErrorFallback";

export default function PlaylistsError({ reset }: { reset: () => void }) {
  return (
    <ErrorFallback
      title="Ошибка плейлистов"
      message="Не удалось загрузить плейлисты."
      backHref="/profile"
      backLabel="К профилю"
      reset={reset}
    />
  );
}
