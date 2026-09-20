"use client";

import React, { useEffect } from "react";

import { ErrorFallback } from "@/shared/ui/ErrorFallback/ErrorFallback";

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

  return <ErrorFallback reset={reset} />;
}
