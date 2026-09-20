"use client";

import { ErrorFallback } from "@/shared/ui/ErrorFallback/ErrorFallback";

export default function ProfileError({ reset }: { reset: () => void }) {
  return (
    <ErrorFallback
      title="Ошибка профиля"
      message="Не удалось загрузить профиль. Возможно, проблема с подключением."
      backHref="/"
      backLabel="На главную"
      reset={reset}
    />
  );
}
