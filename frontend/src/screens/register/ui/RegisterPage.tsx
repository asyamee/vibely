"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useUserStore } from "@/shared/store/userStore";
import { register } from "@/shared/api/auth";
import { AuthLayout } from "@/shared/ui/AuthLayout/AuthLayout";
import { FormField } from "@/shared/ui/FormField/FormField";
import { Button } from "@/shared/ui/Button/Button";

import styles from "./RegisterPage.module.css";

const registerSchema = z
  .object({
    email: z.string().email("Введи корректный email"),
    password: z
      .string()
      .min(8, "Пароль минимум 8 символов")
      .regex(/[a-zA-Zа-яА-Я]/, "Пароль должен содержать хотя бы одну букву")
      .regex(/\d/, "Пароль должен содержать хотя бы одну цифру"),
    confirmPassword: z.string(),
    displayName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type TRegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const router = useRouter();
  const { setAuth } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TRegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "", displayName: "" },
  });

  const onSubmit = async (data: TRegisterFormData) => {
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
    <AuthLayout
      title="Регистрация Vibely"
      subtitle="Присоединяйся и откройся музыке"
      footer={<>Уже есть аккаунт? <a href="/login">Войди</a></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <FormField<TRegisterFormData>
          name="email"
          control={control}
          type="email"
          placeholder="Email"
          autoComplete="email"
          error={errors.email?.message}
        />

        <FormField<TRegisterFormData>
          name="password"
          control={control}
          type="password"
          placeholder="Пароль"
          autoComplete="new-password"
          error={errors.password?.message}
        />

        <FormField<TRegisterFormData>
          name="confirmPassword"
          control={control}
          type="password"
          placeholder="Подтвердить пароль"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
        />

        <FormField<TRegisterFormData>
          name="displayName"
          control={control}
          placeholder="Имя (опционально)"
        />

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
    </AuthLayout>
  );
};
