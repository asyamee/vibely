"use client";

import React, { useState } from "react";

import { changePassword } from "@/shared/api/users";
import { parseApiError } from "@/shared/lib/parseApiError";
import { Modal } from "@/shared/ui/Modal/Modal";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

import styles from "./ProfileSettingsPage.module.css";

interface IChangePasswordModalProps {
  userId: string;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<IChangePasswordModalProps> = ({
  userId,
  onClose,
}) => {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setErr(null);
    if (newPassword.length < 8) {
      setErr("Новый пароль минимум 8 символов");
      return;
    }
    if (newPassword !== confirm) {
      setErr("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      await changePassword(userId, currentPassword, newPassword);
      setDone(true);
    } catch (e: unknown) {
      setErr(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Смена пароля">
      {done ? (
        <>
          <p>Пароль обновлён.</p>
          <Button variant="primary" onClick={onClose}>Закрыть</Button>
        </>
      ) : (
        <>
          <Input
            type="password"
            placeholder="Текущий пароль"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Новый пароль"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Повтор нового пароля"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {err && <p className={styles.fieldError}>{err}</p>}
          <div className={styles.actions}>
            <Button variant="secondary" type="button" onClick={onClose}>Отмена</Button>
            <Button variant="primary" type="button" onClick={submit} disabled={busy}>
              {busy ? "Сохранение..." : "Сменить"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};
