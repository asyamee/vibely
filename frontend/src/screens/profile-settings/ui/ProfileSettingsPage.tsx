"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUserStore } from "@/shared/store/userStore";
import { getProfile, updateProfile } from "@/shared/api/users.api";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import styles from "./ProfileSettingsPage.module.css";

const profileSchema = z.object({
  displayName: z.string().min(1, "Имя не может быть пустым").max(100),
  genres: z.string().min(1, "Хотя бы один жанр обязателен"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const ProfileSettingsPage: React.FC = () => {
  const router = useRouter();
  const { userId, setProfile } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      genres: "",
    },
  });

  useEffect(() => {
    if (!userId) return;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const profileData = await getProfile(userId);
        reset({
          displayName: profileData.displayName || "",
          genres: profileData.genres?.join(", ") || "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки профиля");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!userId) return;

    setSaving(true);
    setError(null);

    try {
      const genres = data.genres
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      await updateProfile(userId, data.displayName, genres);

      const updatedProfile = await getProfile(userId);
      setProfile(updatedProfile);

      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className={styles.container}>
        <p className={styles.message}>Пожалуйста, сначала оцени плейлист</p>
      </div>
    );
  }

  if (loading) {
    return <div className={styles.container}>Загрузка...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Настройки профиля</h1>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="displayName" className={styles.label}>
            Имя
          </label>
          <Controller
            name="displayName"
            control={control}
            render={({ field }) => (
              <>
                <Input
                  id="displayName"
                  placeholder="Введите ваше имя"
                  {...field}
                />
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
                <Input
                  id="genres"
                  placeholder="Рок, Поп, Электроника"
                  {...field}
                />
                {errors.genres && (
                  <p className={styles.fieldError}>{errors.genres.message}</p>
                )}
              </>
            )}
          />
        </div>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            type="button"
            onClick={() => router.back()}
          >
            Отмена
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </form>
    </div>
  );
};
