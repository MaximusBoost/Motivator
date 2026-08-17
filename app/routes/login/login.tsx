import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import type { Route } from "./+types/login";
import { useAuth } from "~/features/auth/AuthProvider";
import { Button } from "~/secondApp/components/Button/Button";
import { AuthLayout } from "../auth/AuthLayout";
import styles from "../auth/auth.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Вход | Motivator" }];
}

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function Login() {
  const { user, signIn, continueAsDemo, isDemoMode } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const next = safeNext(searchParams.get("next"));

  if (user) return <Navigate to={next} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      await signIn(String(form.get("email")), String(form.get("password")));
      navigate(next, { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось войти.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemo() {
    await continueAsDemo();
    navigate(next === "/" ? "/onboarding" : next, { replace: true });
  }

  return (
    <AuthLayout
      title="Вход"
      description="Вернитесь к своему плану и продолжите обучение."
      footer={<>Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></>}
    >
      {isDemoMode && (
        <p className={styles.modeNotice}>
          Supabase пока не настроен — данные входа сохраняются только в этом браузере.
        </p>
      )}

      {searchParams.has("registered") && (
        <p className={styles.success} role="status">
          Аккаунт создан. Если подтверждение email включено в Supabase, откройте письмо перед входом.
        </p>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className={styles.field}>
          <label htmlFor="login-password">Пароль</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" required />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <Button text={isSubmitting ? "Входим…" : "Войти"} type="submit" disabled={isSubmitting} fullWidth />

        {isDemoMode && (
          <>
            <div className={styles.divider}>или</div>
            <Button text="Открыть демо-аккаунт" variant="secondary" fullWidth onClick={handleDemo} />
          </>
        )}
      </form>
    </AuthLayout>
  );
}
