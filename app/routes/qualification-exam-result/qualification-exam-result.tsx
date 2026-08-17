import type { Route } from "./+types/qualification-exam-result";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import { qualificationLabels } from "~/data/qualification-policy";
import { getCurrentUserId } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";

import styles from "./qualification-exam-result.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Результат испытания | Motivator" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return learningRepository.getQualificationExamResult(params.attemptId, await getCurrentUserId());
}

export default function QualificationExamResult({ loaderData: result }: Route.ComponentProps) {
  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          {!result ? (
            <section className={styles.notFound}>
              <h1>Результат не найден</h1>
              <Button text="К испытанию" to="/qualification/exam" />
            </section>
          ) : (
            <>
              <header className={`${styles.hero} ${result.qualifiesForTarget ? styles.success : ""}`}>
                <span>Предварительный результат</span>
                <div className={styles.score}>{result.averageScorePercent}%</div>
                <h1>{qualificationLabels[result.predictedQualification]}</h1>
                <p>
                  Цель «{qualificationLabels[result.targetQualification]}»
                  {result.qualifiesForTarget ? " достигнута в тренировочном режиме." : " пока не достигнута."}
                </p>
                <div className={styles.actions}>
                  <Button text="Пройти ещё раз" to="/qualification/exam" />
                  <Button text="Открыть маршрут" to="/qualification" variant="secondary" />
                </div>
              </header>

              <section className={styles.summary}>
                <div><span>Предметов</span><strong>{result.subjectResults.length}</strong></div>
                <div><span>Физподготовка</span><strong>{result.physicalGrade ? `Оценка ${result.physicalGrade}` : "Нет данных"}</strong></div>
                <div><span>Дата</span><strong>{new Intl.DateTimeFormat("ru-RU").format(new Date(result.completedAt))}</strong></div>
              </section>

              <section className={styles.section} aria-labelledby="subject-results-title">
                <h2 id="subject-results-title">Результаты по предметам</h2>
                <div className={styles.resultList}>
                  {result.subjectResults.map((subject) => (
                    <article key={subject.subjectId}>
                      <div>
                        <h3>{subject.subjectTitle}</h3>
                        <p>{subject.correctAnswers} правильных ответов из {subject.totalQuestions}</p>
                      </div>
                      <strong>{subject.scorePercent}%</strong>
                      <span className={styles.grade}>Оценка {subject.grade}</span>
                    </article>
                  ))}
                </div>
              </section>

              {result.blockers.length > 0 && (
                <section className={styles.recommendations} aria-labelledby="recommendations-title">
                  <h2 id="recommendations-title">Что улучшить</h2>
                  <ul>{result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
                </section>
              )}

              <aside className={styles.disclaimer}>
                Это тренировочный прогноз. Он не является решением комиссии, официальной оценкой или основанием для присвоения классности.
              </aside>
            </>
          )}
        </main>
      </AppShell>
    </RequireAuth>
  );
}
