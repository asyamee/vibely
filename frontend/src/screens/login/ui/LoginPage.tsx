"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useUserStore } from "@/shared/store/userStore";
import { login } from "@/shared/api/auth";
import { AuthLayout } from "@/shared/ui/AuthLayout/AuthLayout";
import { FormField } from "@/shared/ui/FormField/FormField";
import { Button } from "@/shared/ui/Button/Button";

import styles from "./LoginPage.module.css";

const loginSchema = z.object({
  email: z.string().email("Введи корректный email"),
  password: z.string().min(8, "Пароль минимум 8 символов"),
});

type TLoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const router = useRouter();
  const { setAuth } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TLoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: TLoginFormData) => {
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
    <AuthLayout
      title="Вход в Vibely"
      subtitle="Войди и откройся музыке"
      footer={<>Нет аккаунта? <a href="/register">Зарегистрируйся</a></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <FormField<TLoginFormData>
          name="email"
          control={control}
          type="email"
          placeholder="Email"
          autoComplete="email"
          error={errors.email?.message}
        />

        <FormField<TLoginFormData>
          name="password"
          control={control}
          type="password"
          placeholder="Пароль"
          autoComplete="current-password"
          error={errors.password?.message}
        />

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
    </AuthLayout>
  );
};
