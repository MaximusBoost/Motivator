import { useEffect, useState } from "react";

import type { Route } from "./+types/home";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import { qualificationLabels } from "~/data/qualification-policy";
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
  const userId = await getCurrentUserId();
  const [dashboard, roadmap] = await Promise.all([
    learningRepository.getDashboard(userId),
    learningRepository.getQualificationRoadmap(userId),
  ]);
  return { dashboard, roadmap };
}

export default function Home({ loaderData: { dashboard, roadmap } }: Route.ComponentProps) {
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
          <h1>Добро пожаловать{user?.username ? `, ${user.username}` : ""}</h1>
          <p>Продолжайте подготовку по своему персональному маршруту.</p>
        </header>

        <section className={styles.routeSummary} aria-labelledby="route-summary-title">
          {roadmap.profile ? (
            <>
              <div className={styles.routeScore}>
                <strong>{roadmap.readinessPercent}%</strong>
                <span>индекс маршрута</span>
              </div>
              <div className={styles.routeCopy}>
                <span>Целевая классность</span>
                <h2 id="route-summary-title">{qualificationLabels[roadmap.profile.targetQualification]}</h2>
                <p>{roadmap.blockers[0] ?? "Базовые этапы маршрута выполнены. Поддерживайте форму."}</p>
              </div>
              <Button text="Открыть маршрут" to="/qualification" variant="secondary" />
            </>
          ) : (
            <>
              <div className={styles.routeScore}><strong>01</strong><span>первый шаг</span></div>
              <div className={styles.routeCopy}>
                <span>Персональный маршрут</span>
                <h2 id="route-summary-title">Выберите цель по классности</h2>
                <p>Укажите обобщённый профиль службы — без номера части, должности и ВУС.</p>
              </div>
              <Button text="Настроить маршрут" to="/onboarding" />
            </>
          )}
        </section>

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
