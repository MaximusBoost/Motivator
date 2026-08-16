import { useState } from "react";
import { useNavigate } from "react-router";

import type { Route } from "./+types/profile";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import { getCurrentUserId, useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { StatCard } from "~/secondApp/components/StatCard/StatCard";

import styles from "./profile.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Профиль | Motivator" }];
}

export async function clientLoader() {
  const userId = await getCurrentUserId();
  const [dashboard, goals] = await Promise.all([
    learningRepository.getDashboard(userId),
    learningRepository.getGoals(userId),
  ]);
  return { dashboard, goals };
}

export default function Profile({ loaderData: { dashboard, goals } }: Route.ComponentProps) {
  const { user, signOut, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось выйти.");
      setIsSigningOut(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header className={styles.header}>
            <h1>Профиль</h1>
            <p>Данные аккаунта и краткая сводка обучения.</p>
          </header>

          <section className={styles.profileCard}>
            <div className={styles.avatar} aria-hidden="true">
              {user?.username.charAt(0).toLocaleUpperCase("ru")}
            </div>
            <div className={styles.identity}>
              <span>Никнейм</span>
              <h2>{user?.username}</h2>
              <p>{user?.email}</p>
            </div>
            <span className={styles.mode}>{isDemoMode ? "Demo-режим" : "Supabase"}</span>
          </section>

          <section className={styles.stats} aria-label="Статистика профиля">
            <StatCard value={dashboard.stats.subjectsStarted} label="Предметов начато" />
            <StatCard value={`${dashboard.stats.averageScore}%`} label="Средний результат" />
            <StatCard value={dashboard.stats.quizzesCompleted} label="Тестов пройдено" />
            <StatCard value={goals.length} label="Целей установлено" />
          </section>

          <div className={styles.settingsGrid}>
            <section className={styles.settingsCard}>
              <h2>Аккаунт</h2>
              <dl>
                <div><dt>Email</dt><dd>{user?.email}</dd></div>
                <div><dt>Никнейм</dt><dd>{user?.username}</dd></div>
                <div><dt>Хранение данных</dt><dd>{isDemoMode ? "Только этот браузер" : "Удалённая база Supabase"}</dd></div>
              </dl>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <Button
                text={isSigningOut ? "Выходим…" : "Выйти из аккаунта"}
                variant="secondary"
                onClick={handleSignOut}
                disabled={isSigningOut}
              />
            </section>

            <section className={styles.securityCard}>
              <h2>Безопасность MVP</h2>
              {isDemoMode ? (
                <p>Локальный режим нужен для разработки интерфейса. Перед деплоем подключите `.env.local` и примените миграции Supabase.</p>
              ) : (
                <p>Пароль обрабатывается Supabase Auth и не хранится в таблице профиля или коде приложения.</p>
              )}
              <p>Service role key никогда не должен попадать в переменные `VITE_*`.</p>
            </section>
          </div>
        </main>
      </AppShell>
    </RequireAuth>
  );
}
