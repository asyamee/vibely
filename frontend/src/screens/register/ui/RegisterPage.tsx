"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUserStore } from "@/shared/store/userStore";
import { register } from "@/shared/api/auth.api";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import styles from "./RegisterPage.module.css";

const registerSchema = z
  .object({
    email: z.string().email("Введи корректный email"),
    password: z.string().min(8, "Пароль минимум 8 символов"),
    confirmPassword: z.string(),
    displayName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const router = useRouter();
  const { setAuth } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "", displayName: "" },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await register({
        email: data.email,
        password: data.password,
        displayName: data.displayName || undefined,
      });
      setAuth(response.userId, response.accessToken);
      router.push("/model-train");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Регистрация Vibely</h1>
        <p className={styles.subtitle}>Присоединяйся и откройся музыке</p>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <>
                  <Input id="email" type="email" placeholder="your@email.com" {...field} />
                  {errors.email && <p className={styles.error}>{errors.email.message}</p>}
                </>
              )}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Пароль
            </label>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...field}
                  />
                  {errors.password && <p className={styles.error}>{errors.password.message}</p>}
                </>
              )}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Подтвердить пароль
            </label>
            <Controller
              name="confirmPassword"
              control={control}
              render={({ field }) => (
                <>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    {...field}
                  />
                  {errors.confirmPassword && (
                    <p className={styles.error}>{errors.confirmPassword.message}</p>
                  )}
                </>
              )}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="displayName" className={styles.label}>
              Имя (опционально)
            </label>
            <Controller
              name="displayName"
              control={control}
              render={({ field }) => (
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Твоё имя"
                  {...field}
                />
              )}
            />
          </div>

          {error && <p className={styles.apiError}>{error}</p>}

          <Button
            variant="primary"
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? "Регистрируемся..." : "Зарегистрироваться"}
          </Button>
        </form>

        <p className={styles.footer}>
          Уже есть аккаунт?{" "}
          <a href="/login" className={styles.link}>
            Войди
          </a>
        </p>
      </div>
    </div>
  );
};
