import React from "react";
import type { IToast } from "./useToast";
import styles from "./Toast.module.css";

interface IToastContainerProps {
  toasts: IToast[];
  onDismiss: (id: number) => void;
}

export const ToastContainer: React.FC<IToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};
