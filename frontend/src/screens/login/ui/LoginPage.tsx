"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUserStore } from "@/shared/store/userStore";
import { login } from "@/shared/api/auth.api";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import styles from "./LoginPage.module.css";

const loginSchema = z.object({
  email: z.string().email("Введи корректный email"),
  password: z.string().min(8, "Пароль минимум 8 символов"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const router = useRouter();
  const { setAuth } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await login(data);
      setAuth(response.userId, response.accessToken);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Вход в Vibely</h1>
        <p className={styles.subtitle}>Войди и откройся музыке</p>

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

          {error && <p className={styles.apiError}>{error}</p>}

          <Button
            variant="primary"
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? "Входим..." : "Войти"}
          </Button>
        </form>

        <p className={styles.footer}>
          Нет аккаунта?{" "}
          <a href="/register" className={styles.link}>
            Зарегистрируйся
          </a>
        </p>
      </div>
    </div>
  );
};
