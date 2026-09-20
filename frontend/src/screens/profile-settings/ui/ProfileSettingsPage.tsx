"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useShallow } from "zustand/react/shallow";

import { useUserStore } from "@/shared/store/userStore";
import { getProfile, updateProfile, type IUserProfile } from "@/shared/api/users";
import { logout as logoutApi } from "@/shared/api/auth";
import { FormField } from "@/shared/ui/FormField/FormField";
import { Button } from "@/shared/ui/Button/Button";
import { BackButton } from "@/shared/ui/BackButton/BackButton";

import { ChangePasswordModal } from "./ChangePasswordModal";
import { DeleteAccountModal } from "./DeleteAccountModal";
import styles from "./ProfileSettingsPage.module.css";

const profileSchema = z.object({
  displayName: z.string().min(1, "Имя не может быть пустым").max(100),
  genres: z.string().min(1, "Хотя бы один жанр обязателен"),
  telegram: z.string().max(64).optional().or(z.literal("")),
  phone: z.string().max(32).optional().or(z.literal("")),
  contactEmail: z.string().email("Некорректный email").optional().or(z.literal("")),
});

type TProfileFormData = z.infer<typeof profileSchema>;

interface IProfileSettingsPageProps {
  userId: string;
  initialProfile: IUserProfile;
}

export const ProfileSettingsPage: React.FC<IProfileSettingsPageProps> = ({
  userId,
  initialProfile,
}) => {
  const router = useRouter();
  const { setProfile, clearUser } = useUserStore(
    useShallow((s) => ({ setProfile: s.setProfile, clearUser: s.clearUser })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<"password" | "delete" | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: initialProfile.displayName || "",
      genres: initialProfile.genres?.join(", ") || "",
      telegram: initialProfile.contacts?.telegram || "",
      phone: initialProfile.contacts?.phone || "",
      contactEmail: initialProfile.contacts?.contactEmail || "",
    },
  });

  const onSubmit = async (data: TProfileFormData) => {
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
        <FormField<TProfileFormData>
          name="displayName"
          control={control}
          placeholder="Имя"
          error={errors.displayName?.message}
        />

        <FormField<TProfileFormData>
          name="genres"
          control={control}
          placeholder="Жанры через запятую"
          error={errors.genres?.message}
        />

        <h2 className={styles.subTitle}>Контакты</h2>

        <FormField<TProfileFormData>
          name="telegram"
          control={control}
          placeholder="Telegram (@username)"
          autoComplete="username"
        />

        <FormField<TProfileFormData>
          name="phone"
          control={control}
          placeholder="Телефон (+7 ...)"
          inputMode="tel"
          autoComplete="tel"
        />

        <FormField<TProfileFormData>
          name="contactEmail"
          control={control}
          type="email"
          placeholder="Email для связи"
          inputMode="email"
          autoComplete="email"
          error={errors.contactEmail?.message}
        />

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
          <Button variant="secondary" type="button" onClick={() => setActiveModal("password")}>
            Сменить пароль
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => setActiveModal("delete")}
            className={styles.deleteBtn}
          >
            Удалить аккаунт
          </Button>
        </div>
      </div>

      {activeModal === "password" && (
        <ChangePasswordModal
          userId={userId}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "delete" && (
        <DeleteAccountModal
          userId={userId}
          onCancel={() => setActiveModal(null)}
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
