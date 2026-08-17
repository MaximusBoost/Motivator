import { useEffect, useState } from "react";

import type { Route } from "./+types/home";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import type { TodayPlanItem } from "~/data/types";
import { getCurrentUserId } from "~/features/auth/AuthProvider";
import { useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { ContinueCard } from "~/secondApp/components/ContinueCard/ContinueCard";
import { StatCard } from "~/secondApp/components/StatCard/StatCard";
import { SubjectCard } from "~/secondApp/components/SubjectCard/SubjectCard";
import { TodayPlan } from "~/secondApp/components/TodayPlan/TodayPlan";

import styles from "./home.module.scss";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Главная | Motivator" },
    { name: "description", content: "Персональный план и прогресс обучения" },
  ];
}

export async function clientLoader() {
  return learningRepository.getDashboard(await getCurrentUserId());
}

export default function Home({ loaderData: dashboard }: Route.ComponentProps) {
  const { user } = useAuth();
  const [todayPlan, setTodayPlan] = useState<TodayPlanItem[]>(dashboard.todayPlan);
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    setTodayPlan(dashboard.todayPlan);
  }, [dashboard.todayPlan]);

  function handleTaskToggle(taskId: string, isCompleted: boolean) {
    setPlanError("");
    setTodayPlan((currentTasks) =>
      currentTasks.map((task) => task.id === taskId ? { ...task, isCompleted } : task),
    );
    void learningRepository.setTodayPlanItemCompleted(taskId, isCompleted, user?.id)
      .catch((error: unknown) => {
        setTodayPlan((currentTasks) =>
          currentTasks.map((task) => task.id === taskId ? { ...task, isCompleted: !isCompleted } : task),
        );
        setPlanError(error instanceof Error ? error.message : "Не удалось обновить план.");
      });
  }

  const stats = [
    { value: dashboard.stats.subjectsStarted, label: "Начато предметов" },
    { value: `${dashboard.stats.averageScore}%`, label: "Средний результат" },
    { value: dashboard.stats.quizzesCompleted, label: "Тестов пройдено" },
    { value: dashboard.stats.needsReview, label: "Нужно повторить" },
  ];

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
        <header className={styles.header}>
          <h1>Добро пожаловать</h1>
          <p>Продолжайте обучение и следите за своим прогрессом.</p>
        </header>

        <section className={styles.stats} aria-label="Статистика обучения">
          {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </section>

        <div className={styles.dashboardGrid}>
          <section className={styles.continueSection} aria-labelledby="continue-title">
            <div className={styles.sectionHeading}>
              <h2 id="continue-title">Продолжить обучение</h2>
            </div>

            {dashboard.continueLearning ? (
              <ContinueCard item={dashboard.continueLearning} />
            ) : (
              <div className={styles.emptyState}>
                <h3>Вы ещё не начали обучение</h3>
                <p>Выберите первый предмет, чтобы сформировать персональный план.</p>
                <Button text="Выбрать предмет" to="/subjects" />
              </div>
            )}
          </section>

          <div className={styles.planColumn}>
            <TodayPlan items={todayPlan} onToggle={handleTaskToggle} />
            {planError && <p className={styles.planError} role="alert">{planError}</p>}
          </div>
        </div>

        <section className={styles.subjectsSection} aria-labelledby="featured-title">
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionHeadingH2} id="featured-title">Предметы</h2>
            <Button text="Все предметы" to="/subjects" variant="secondary" size="s" />
          </div>

          <div className={styles.subjectsGrid}>
            {dashboard.featuredSubjects.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        </section>
        </main>
      </AppShell>
    </RequireAuth>
  );
}
