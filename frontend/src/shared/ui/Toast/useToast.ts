import { useState, useCallback } from "react";

export interface IToast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<IToast[]>([]);

  const show = useCallback((message: string, type: IToast["type"] = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}
