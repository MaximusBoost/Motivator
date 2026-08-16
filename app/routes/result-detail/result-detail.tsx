import type { Route } from "./+types/result-detail";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import { getCurrentUserId } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";

import styles from "./result-detail.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Результат проверки | Motivator" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const userId = await getCurrentUserId();
  const [result, subjects] = await Promise.all([
    learningRepository.getResult(params.attemptId, userId),
    learningRepository.getSubjects(userId),
  ]);
  if (!result) throw new Response("Результат не найден", { status: 404 });

  for (const subject of subjects) {
    for (const module of subject.modules) {
      const activity = module.activities.find((item) => item.id === result.activityId);
      if (activity) return { result, subject, module, activity };
    }
  }

  return { result, subject: null, module: null, activity: null };
}

export default function ResultDetail({
  loaderData: { result, subject, module, activity },
}: Route.ComponentProps) {
  const isReviewing = result.score === 0 && result.statusLabel === "Ответ отправлен";

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header className={styles.header}>
            {subject && <p>{subject.title}</p>}
            <h1>Результат проверки</h1>
            <span>{module ? `Модуль ${module.number}` : "Учебное задание"} • {activity?.title ?? "Результат"}</span>
          </header>

          <section className={styles.scoreSummary}>
            <div className={styles.scoreBlock}>
              <strong>{isReviewing ? "—" : result.score}</strong>
              {!isReviewing && <span>/ 100</span>}
              <small>{result.statusLabel}</small>
            </div>
            <p>{result.summary}</p>
            <div className={styles.summaryActions}>
              {module && <Button text="Повторить тему" to={`/modules/${module.id}`} variant="secondary" fullWidth />}
              <Button text="К предметам" to="/subjects" fullWidth />
            </div>
          </section>

          {(result.criterionScores.length > 0 || result.aiFeedback) && (
            <div className={styles.feedbackGrid}>
              {result.criterionScores.length > 0 && (
                <section className={styles.criteria}>
                  <h2>Оценка по критериям</h2>
                  {result.criterionScores.map((criterion, index) => (
                    <div className={styles.criterion} key={criterion.criterionId}>
                      <span>{criterion.title}</span>
                      <strong>{criterion.score} / 100</strong>
                      <ProgressTrack value={criterion.score} color={index === 1 ? "olive" : "blue"} />
                    </div>
                  ))}
                </section>
              )}

              {result.aiFeedback && (
                <section className={styles.aiFeedback}>
                  <h2>Комментарий ИИ</h2>
                  <h3 className={styles.strength}>Сильная сторона</h3>
                  <p>{result.aiFeedback.strength}</p>
                  <h3 className={styles.improvement}>Что улучшить</h3>
                  <p>{result.aiFeedback.improvement}</p>
                  <h3>Рекомендация</h3>
                  <p><strong>{result.aiFeedback.recommendation}</strong></p>
                </section>
              )}
            </div>
          )}

          {result.submittedAnswer && (
            <section className={styles.submittedAnswer}>
              <h2>Ваш ответ</h2>
              <p>{result.submittedAnswer}</p>
              <footer>
                {isReviewing
                  ? "Ответ сохранён • проверка ожидается"
                  : "Проверено автоматически • результат сохранён в профиле"}
              </footer>
            </section>
          )}
        </main>
      </AppShell>
    </RequireAuth>
  );
}
