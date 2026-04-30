"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUserStore } from "@/shared/store/userStore";
import {
  changePassword,
  deleteAccount,
  getProfile,
  updateProfile,
  type UserProfile,
} from "@/shared/api/users.api";
import { logout as logoutApi } from "@/shared/api/auth.api";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { BackButton } from "@/shared/ui/BackButton/BackButton";
import styles from "./ProfileSettingsPage.module.css";

const profileSchema = z.object({
  displayName: z.string().min(1, "Имя не может быть пустым").max(100),
  genres: z.string().min(1, "Хотя бы один жанр обязателен"),
  telegram: z.string().max(64).optional().or(z.literal("")),
  phone: z.string().max(32).optional().or(z.literal("")),
  contactEmail: z.string().email("Некорректный email").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileSettingsPageProps {
  userId: string;
  initialProfile: UserProfile;
}

export const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({
  userId,
  initialProfile,
}) => {
  const router = useRouter();
  const setProfile = useUserStore((s) => s.setProfile);
  const clearUser = useUserStore((s) => s.clearUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: initialProfile.displayName || "",
      genres: initialProfile.genres?.join(", ") || "",
      telegram: initialProfile.contacts?.telegram || "",
      phone: initialProfile.contacts?.phone || "",
      contactEmail: initialProfile.contacts?.contactEmail || "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    setError(null);

    try {
      const genres = data.genres
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      await updateProfile(userId, {
        displayName: data.displayName,
        genres,
        telegram: data.telegram?.trim() || null,
        phone: data.phone?.trim() || null,
        contactEmail: data.contactEmail?.trim() || null,
      });

      const updatedProfile = await getProfile(userId);
      setProfile(updatedProfile);

      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <BackButton fallbackHref="/profile" />
      <div className={styles.header}>
        <h1 className={styles.title}>Настройки профиля</h1>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="displayName" className={styles.label}>Имя</label>
          <Controller
            name="displayName"
            control={control}
            render={({ field }) => (
              <>
                <Input id="displayName" placeholder="Введите ваше имя" {...field} />
                {errors.displayName && (
                  <p className={styles.fieldError}>{errors.displayName.message}</p>
                )}
              </>
            )}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="genres" className={styles.label}>
            Любимые жанры (через запятую)
          </label>
          <Controller
            name="genres"
            control={control}
            render={({ field }) => (
              <>
                <Input id="genres" placeholder="Рок, Поп, Электроника" {...field} />
                {errors.genres && (
                  <p className={styles.fieldError}>{errors.genres.message}</p>
                )}
              </>
            )}
          />
        </div>

        <h2 className={styles.subTitle}>Контакты для связи (опционально)</h2>

        <div className={styles.formGroup}>
          <label htmlFor="telegram" className={styles.label}>Telegram</label>
          <Controller
            name="telegram"
            control={control}
            render={({ field }) => (
              <Input id="telegram" placeholder="@username" {...field} />
            )}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="phone" className={styles.label}>Телефон</label>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <Input id="phone" placeholder="+7 ..." {...field} />
            )}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="contactEmail" className={styles.label}>Email для связи</label>
          <Controller
            name="contactEmail"
            control={control}
            render={({ field }) => (
              <>
                <Input id="contactEmail" placeholder="contact@example.com" {...field} />
                {errors.contactEmail && (
                  <p className={styles.fieldError}>{errors.contactEmail.message}</p>
                )}
              </>
            )}
          />
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </form>

      <div className={styles.dangerZone}>
        <h2 className={styles.subTitle}>Безопасность</h2>
        <div className={styles.dangerActions}>
          <Button variant="secondary" type="button" onClick={() => setShowPasswordModal(true)}>
            Сменить пароль
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className={styles.deleteBtn}
          >
            Удалить аккаунт
          </Button>
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          userId={userId}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteAccountModal
          userId={userId}
          onCancel={() => setShowDeleteModal(false)}
          onDeleted={async () => {
            try { await logoutApi(); } catch {}
            clearUser();
            router.push("/login");
          }}
        />
      )}
    </div>
  );
};

const ChangePasswordModal: React.FC<{ userId: string; onClose: () => void }> = ({
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
      const message =
        e && typeof e === "object" && "response" in e
          ? ((e as { response?: { data?: { message?: string } } }).response?.data?.message ??
              "Ошибка")
          : "Ошибка";
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Смена пароля</h3>
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
      </div>
    </div>
  );
};

const DeleteAccountModal: React.FC<{
  userId: string;
  onCancel: () => void;
  onDeleted: () => void;
}> = ({ userId, onCancel, onDeleted }) => {
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
      const message =
        e && typeof e === "object" && "response" in e
          ? ((e as { response?: { data?: { message?: string } } }).response?.data?.message ??
              "Ошибка")
          : "Ошибка";
      setErr(message);
      setBusy(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Удаление аккаунта</h3>
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
      </div>
    </div>
  );
};
