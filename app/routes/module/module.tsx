import { useState } from "react";
import { Link, useNavigate } from "react-router";

import type { Route } from "./+types/module";
import { LearningShell } from "~/components/LearningShell/LearningShell";
import { learningRepository } from "~/data/learning";
import { getCurrentUserId, useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";

import styles from "./module.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Учебный модуль | Motivator" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const userId = await getCurrentUserId();
  const [module, subjects] = await Promise.all([
    learningRepository.getModule(params.moduleId, userId),
    learningRepository.getSubjects(userId),
  ]);
  if (!module) throw new Response("Модуль не найден", { status: 404 });
  const subject = subjects.find((item) => item.id === module.subjectId);
  if (!subject) throw new Response("Предмет не найден", { status: 404 });
  return { module, subject };
}

export default function Module({ loaderData: { module, subject } }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const theory = module.activities.find((activity) => activity.type === "theory");
  const quizzes = module.activities.filter((activity) => activity.type === "quiz");
  const freeAnswers = module.activities.filter((activity) => activity.type === "free_answer");
  const questionCount = quizzes.reduce((total, quiz) => total + quiz.questions.length, 0);
  const nextActivity = quizzes[0] ?? freeAnswers[0];

  const objective = module.objective ??
    "Изучить ключевые понятия модуля, закрепить последовательность действий и проверить понимание материала.";
  const keyPrinciple = module.keyPrinciple ??
    "Сначала разберитесь в исходных условиях, затем применяйте изученный алгоритм.";

  async function handleContinue() {
    if (!nextActivity) return;
    setIsCompleting(true);
    setActionError("");
    try {
      if (theory) await learningRepository.completeTheory(theory.id, user?.id);
      navigate(`/activities/${nextActivity.id}`);
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Не удалось обновить прогресс.");
      setIsCompleting(false);
    }
  }

  return (
    <RequireAuth>
      <LearningShell subject={subject} currentModule={module}>
        <main className={styles.page}>
          <Link className={styles.back} to={`/subjects/${subject.slug}`}>← К предмету</Link>
          <header className={styles.header}>
            <h1>{module.title}</h1>
            <p>Теоретический материал • ориентировочно {theory?.estimatedMinutes ?? module.estimatedMinutes ?? 12} минут</p>
          </header>

          <div className={styles.layout}>
            <article className={styles.article}>
              <span className={styles.eyebrow}>Цель модуля</span>
              <p className={styles.objective}>{objective}</p>

              <section className={styles.principle}>
                <span>Главный принцип</span>
                <p>{keyPrinciple}</p>
              </section>

              {module.sections.length > 0 ? (
                <div className={styles.sections}>
                  {module.sections.map((section) => (
                    <section key={section.id}>
                      <h2>{section.title}</h2>
                      <p>{section.body}</p>
                    </section>
                  ))}
                </div>
              ) : (
                <section className={styles.placeholder}>
                  <h2>Материал модуля</h2>
                  <p>
                    Теоретическая часть для этого модуля будет наполнена через базу данных.
                    Структура страницы и переход к проверке знаний уже готовы.
                  </p>
                </section>
              )}

              {module.sources.length > 0 && (
                <section className={styles.sources} aria-labelledby="module-sources-title">
                  <h2 id="module-sources-title">Основа материала</h2>
                  <p className={styles.sourcesIntro}>
                    Сверяйте учебные положения с действующими документами и указаниями руководителя занятий.
                  </p>
                  <ul>
                    {module.sources.map((source) => (
                      <li key={source.id}>
                        <div className={styles.sourceHeading}>
                          {source.uri ? (
                            <a href={source.uri} target="_blank" rel="noreferrer">
                              {source.title}
                            </a>
                          ) : (
                            <strong>{source.title}</strong>
                          )}
                          <span data-current={source.isCurrentVerified}>
                            {source.isCurrentVerified ? "проверено" : "требует сверки"}
                          </span>
                        </div>
                        <p>{source.versionLabel} · {source.locator}</p>
                        <small>{source.notes}</small>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className={styles.shortSummary}>
                <span>Кратко</span>
                <p>{module.shortSummary ?? "Изучить материал → проверить понимание → закрепить результат."}</p>
              </section>
            </article>

            <aside className={styles.aside}>
              <section className={styles.actionsCard}>
                <h2>В этом модуле</h2>
                <ul>
                  <li>Теория</li>
                  {questionCount > 0 && <li>{questionCount} тестовых вопросов</li>}
                  {freeAnswers.length > 0 && <li>{freeAnswers.length} свободных ответов</li>}
                </ul>
                <div className={styles.readProgress}>
                  <span>Материал прочитан</span>
                  <ProgressTrack value={module.progressPercent} />
                </div>
                {nextActivity ? (
                  <Button
                    text={isCompleting ? "Сохраняем…" : quizzes.length > 0 ? "Перейти к тесту" : "Перейти к заданию"}
                    onClick={handleContinue}
                    disabled={isCompleting}
                    fullWidth
                  />
                ) : (
                  <Button text="Проверка скоро появится" disabled fullWidth />
                )}
                {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
              </section>

              <section className={styles.tip}>
                <h2>Совет</h2>
                <p>{module.learningTip ?? "После чтения перескажите основные мысли своими словами и только затем переходите к проверке."}</p>
              </section>
            </aside>
          </div>
        </main>
      </LearningShell>
    </RequireAuth>
  );
}
