"use client";

import { ErrorFallback } from "@/shared/ui/ErrorFallback/ErrorFallback";

export default function SettingsError({ reset }: { reset: () => void }) {
  return (
    <ErrorFallback
      title="Ошибка настроек"
      message="Не удалось загрузить настройки профиля."
      backHref="/profile"
      backLabel="К профилю"
      reset={reset}
    />
  );
}
