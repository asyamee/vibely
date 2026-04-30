"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/Button/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "60px 20px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 26, margin: 0, color: "var(--color-text)" }}>Что-то пошло не так</h1>
      <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
        Не удалось загрузить страницу. Попробуй обновить или вернуться на главную.
      </p>
      {error.digest && (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
          ID: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Button variant="primary" onClick={reset}>
          Повторить
        </Button>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Button variant="secondary">На главную</Button>
        </Link>
      </div>
    </div>
  );
}
