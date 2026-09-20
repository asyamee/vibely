"use client";

import React from "react";
import Link from "next/link";

import { Button } from "@/shared/ui/Button/Button";

import styles from "./ErrorFallback.module.css";

interface IErrorFallbackProps {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
  reset: () => void;
}

export const ErrorFallback: React.FC<IErrorFallbackProps> = ({
  title = "Что-то пошло не так",
  message = "Не удалось загрузить страницу. Попробуй обновить или вернуться назад.",
  backHref = "/",
  backLabel = "На главную",
  reset,
}) => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={reset}>
          Повторить
        </Button>
        <Link href={backHref} className={styles.link}>
          <Button variant="secondary">{backLabel}</Button>
        </Link>
      </div>
    </div>
  );
};
