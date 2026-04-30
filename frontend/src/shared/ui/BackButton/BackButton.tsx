"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import styles from "./BackButton.module.css";

interface Props {
  fallbackHref?: string;
  label?: string;
}

export const BackButton: React.FC<Props> = ({ fallbackHref = "/", label = "Назад" }) => {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button type="button" onClick={handleClick} className={styles.button} aria-label={label}>
      <ArrowLeft size={18} />
      <span>{label}</span>
    </button>
  );
};
