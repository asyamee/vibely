"use client";

import { ErrorFallback } from "@/shared/ui/ErrorFallback/ErrorFallback";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <ErrorFallback
      title="Ошибка админки"
      message="Не удалось загрузить панель управления."
      backHref="/"
      backLabel="На главную"
      reset={reset}
    />
  );
}
