"use client";

import React, { useState } from "react";

import { deleteAccount } from "@/shared/api/users";
import { parseApiError } from "@/shared/lib/parseApiError";
import { Modal } from "@/shared/ui/Modal/Modal";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

import styles from "./ProfileSettingsPage.module.css";

interface IDeleteAccountModalProps {
  userId: string;
  onCancel: () => void;
  onDeleted: () => void;
}

export const DeleteAccountModal: React.FC<IDeleteAccountModalProps> = ({
  userId,
  onCancel,
  onDeleted,
}) => {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await deleteAccount(userId, password);
      onDeleted();
    } catch (e: unknown) {
      setErr(parseApiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onCancel} title="Удаление аккаунта">
      <p>Действие необратимо. Будут удалены все данные: оценки, друзья, эмбеддинг.</p>
      <Input
        type="password"
        placeholder="Введите пароль для подтверждения"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {err && <p className={styles.fieldError}>{err}</p>}
      <div className={styles.actions}>
        <Button variant="secondary" type="button" onClick={onCancel}>Отмена</Button>
        <Button
          variant="primary"
          type="button"
          onClick={submit}
          disabled={busy || !password}
          className={styles.deleteBtn}
        >
          {busy ? "Удаляем..." : "Удалить навсегда"}
        </Button>
      </div>
    </Modal>
  );
};
