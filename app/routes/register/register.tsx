import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import type { Route } from "./+types/register";
import { useAuth } from "~/features/auth/AuthProvider";
import { Button } from "~/secondApp/components/Button/Button";
import { AuthLayout } from "../auth/AuthLayout";
import styles from "../auth/auth.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Регистрация | Motivator" }];
}

const usernamePattern = /^[\p{L}\p{N}_-]{3,24}$/u;

export default function Register() {
  const { user, signUp, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/onboarding" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username")).trim();
    const password = String(form.get("password"));
    const passwordConfirm = String(form.get("passwordConfirm"));

    if (!usernamePattern.test(username)) {
      setError("Никнейм: 3–24 символа, только буквы, цифры, дефис и нижнее подчёркивание.");
      return;
    }
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Пароли не совпадают.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp({
        email: String(form.get("email")),
        password,
        username,
      });
      navigate(result.requiresEmailConfirmation ? "/login?registered=1" : "/onboarding", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось создать аккаунт.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Создать аккаунт"
      description="Регистрация сохранит личные цели, результаты и прогресс."
      footer={<>Уже есть аккаунт? <Link to="/login">Войти</Link></>}
    >
      {isDemoMode && (
        <p className={styles.modeNotice}>
          Локальный demo-режим: аккаунт доступен только в этом браузере.
        </p>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="register-username">Никнейм</label>
          <input id="register-username" name="username" autoComplete="username" minLength={3} maxLength={24} required />
          <small>3–24 символа: буквы, цифры, «-» и «_».</small>
        </div>

        <div className={styles.field}>
          <label htmlFor="register-email">Email</label>
          <input id="register-email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className={styles.field}>
          <label htmlFor="register-password">Пароль</label>
          <input id="register-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>

        <div className={styles.field}>
          <label htmlFor="register-password-confirm">Повторите пароль</label>
          <input id="register-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <Button text={isSubmitting ? "Создаём аккаунт…" : "Зарегистрироваться"} type="submit" disabled={isSubmitting} fullWidth />
      </form>
    </AuthLayout>
  );
}
