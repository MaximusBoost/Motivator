import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import clsx from "clsx";

import type { Route } from "./+types/activity";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import type { FreeAnswerActivity, LearningModule, QuizActivity, Subject } from "~/data/types";
import { getCurrentUserId, useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";

import styles from "./activity.module.scss";

type ActivityContext = {
  subject: Subject;
  module: LearningModule;
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Учебное задание | Motivator" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const userId = await getCurrentUserId();
  const [quiz, freeAnswer, subjects] = await Promise.all([
    learningRepository.getQuiz(params.activityId),
    learningRepository.getFreeAnswer(params.activityId),
    learningRepository.getSubjects(userId),
  ]);

  const activity = quiz ?? freeAnswer;
  if (!activity) throw new Response("Задание не найдено", { status: 404 });

  for (const subject of subjects) {
    const module = subject.modules.find((item) => item.id === activity.moduleId);
    if (module) {
      return quiz
        ? { kind: "quiz" as const, activity: quiz, subject, module }
        : { kind: "free_answer" as const, activity: freeAnswer!, subject, module };
    }
  }

  throw new Response("Модуль задания не найден", { status: 404 });
}

function AssessmentHeader({
  subject,
  title,
  counter,
  progress,
}: {
  subject: Subject;
  title: string;
  counter: string;
  progress: number;
}) {
  return (
    <header className={styles.header}>
      <p>{subject.title}</p>
      <h1>{title}</h1>
      <span>{counter}</span>
      <ProgressTrack value={progress} />
    </header>
  );
}

function QuizView({ activity, subject, module }: ActivityContext & { activity: QuizActivity }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const question = activity.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  useEffect(() => {
    if (!user || answeredCount === 0) return;
    void learningRepository
      .saveQuizProgress(activity.id, answeredCount, activity.questions.length, user.id)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : "Не удалось сохранить прогресс.");
      });
  }, [activity.id, activity.questions.length, answeredCount, user]);

  if (!question) {
    return <section className={styles.emptyActivity}>В этом тесте пока нет вопросов.</section>;
  }

  async function submitQuiz() {
    setIsSubmitting(true);
    setError("");
    try {
      const result = await learningRepository.submitQuiz(activity.id, answers, user?.id);
      navigate(`/results/${result.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось отправить тест.");
      setIsSubmitting(false);
    }
  }

  function handleContinue() {
    if (!answers[question.id]) {
      setError("Выберите вариант ответа.");
      return;
    }
    setError("");

    if (currentIndex < activity.questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      return;
    }

    const firstUnanswered = activity.questions.findIndex((item) => !answers[item.id]);
    if (firstUnanswered >= 0) {
      setCurrentIndex(firstUnanswered);
      setError("Перед отправкой ответьте на оставшиеся вопросы.");
      return;
    }

    void submitQuiz();
  }

  return (
    <main className={styles.page}>
      <AssessmentHeader
        subject={subject}
        title={activity.title}
        counter={`Вопрос ${currentIndex + 1} из ${activity.questions.length}`}
        progress={answeredCount * 100 / activity.questions.length}
      />

      <div className={styles.assessmentGrid}>
        <section className={styles.questionCard}>
          <span className={styles.quizChip}>Один вариант ответа</span>
          <h2>{question.prompt}</h2>
          <p className={styles.instructions}>{question.instructions}</p>

          <fieldset className={styles.answers}>
            <legend className={styles.visuallyHidden}>Варианты ответа</legend>
            {question.options.map((option) => (
              <label
                key={option.id}
                className={clsx(styles.answer, answers[question.id] === option.id && styles.selectedAnswer)}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.id}
                  checked={answers[question.id] === option.id}
                  onChange={() => {
                    setAnswers((current) => ({ ...current, [question.id]: option.id }));
                    setError("");
                  }}
                />
                <strong>{option.label}</strong>
                <span>{option.text}</span>
              </label>
            ))}
          </fieldset>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button
              text="Назад"
              variant="secondary"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
            />
            <Button
              text={isSubmitting ? "Отправляем…" : currentIndex === activity.questions.length - 1 ? "Завершить тест" : "Ответить и продолжить"}
              disabled={isSubmitting}
              onClick={handleContinue}
            />
          </div>
        </section>

        <aside className={styles.assessmentAside}>
          <section className={styles.quizNavigation}>
            <h2>Навигация по тесту</h2>
            <div className={styles.questionButtons}>
              {activity.questions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={clsx(
                    answers[item.id] && styles.answeredQuestion,
                    index === currentIndex && styles.currentQuestion,
                  )}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Вопрос ${index + 1}`}
                  aria-current={index === currentIndex ? "step" : undefined}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <dl>
              <div><dt>{answeredCount}</dt><dd>отвечено</dd></div>
              <div><dt>1</dt><dd>текущий</dd></div>
              <div><dt>{activity.questions.length - answeredCount}</dt><dd>осталось</dd></div>
            </dl>
          </section>

          {question.hint && (
            <section className={styles.hint}>
              <h2>Подсказка</h2>
              <p>{question.hint}</p>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function FreeAnswerView({ activity, subject, module }: ActivityContext & { activity: FreeAnswerActivity }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [answer, setAnswer] = useState("");
  const [saveStatus, setSaveStatus] = useState("Черновик ещё не сохранён");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const freeAnswers = useMemo(
    () => module.activities.filter((item): item is FreeAnswerActivity => item.type === "free_answer"),
    [module.activities],
  );
  const taskIndex = Math.max(0, freeAnswers.findIndex((item) => item.id === activity.id));

  useEffect(() => {
    if (!answer.trim() || !user) return;
    setSaveStatus("Сохраняем черновик…");
    const timer = window.setTimeout(() => {
      void learningRepository.saveFreeAnswerDraft(activity.id, answer, user.id)
        .then(() => setSaveStatus("Черновик сохранён автоматически"))
        .catch(() => setSaveStatus("Не удалось сохранить черновик"));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activity.id, answer, user]);

  async function saveDraft() {
    if (!user) return;
    setSaveStatus("Сохраняем черновик…");
    try {
      await learningRepository.saveFreeAnswerDraft(activity.id, answer, user.id);
      setSaveStatus("Черновик сохранён");
    } catch (caughtError) {
      setSaveStatus("Не удалось сохранить черновик");
      setError(caughtError instanceof Error ? caughtError.message : "Ошибка сохранения.");
    }
  }

  async function submitAnswer() {
    if (answer.trim().length < 20) {
      setError("Добавьте больше деталей: минимум 20 символов.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const result = await learningRepository.submitFreeAnswer(activity.id, answer, user?.id);
      navigate(`/results/${result.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось отправить ответ.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <AssessmentHeader
        subject={subject}
        title="Развернутый ответ"
        counter={`Задание ${taskIndex + 1} из ${freeAnswers.length}`}
        progress={(taskIndex + 1) * 100 / Math.max(1, freeAnswers.length)}
      />

      <div className={styles.answerGrid}>
        <section className={styles.freeAnswerCard}>
          <span className={styles.freeChip}>Свободный ответ</span>
          <h2>{activity.prompt}</h2>
          <p className={styles.instructions}>{activity.instructions}</p>

          <label className={styles.textareaLabel} htmlFor="free-answer">Ваш ответ</label>
          <div className={styles.textareaWrapper}>
            <textarea
              id="free-answer"
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value.slice(0, activity.maxLength));
                setError("");
              }}
              placeholder="Введите развернутый ответ…"
              rows={12}
            />
            <span>{saveStatus}</span>
            <strong>{answer.length} / {activity.maxLength}</strong>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button text="Сохранить черновик" variant="secondary" onClick={saveDraft} />
            <Button text={isSubmitting ? "Отправляем…" : "Отправить на проверку"} disabled={isSubmitting} onClick={submitAnswer} />
          </div>
          <p className={styles.afterSubmit}>После отправки ответ будет проанализирован по указанным критериям.</p>
        </section>

        <aside className={styles.assessmentAside}>
          <section className={styles.criteriaCard}>
            <h2>Критерии проверки</h2>
            {activity.criteria.map((criterion) => (
              <div className={styles.criterion} key={criterion.id}>
                <span>{criterion.title}</span>
                <strong>{criterion.weightPercent}%</strong>
                <ProgressTrack value={criterion.weightPercent} color={criterion.position === 2 ? "olive" : "blue"} />
              </div>
            ))}
          </section>

          <section className={styles.reviewInfo}>
            <h2>Как проходит проверка</h2>
            <ol>
              <li>Анализируется структура ответа.</li>
              <li>Отмечаются сильные и слабые места.</li>
              <li>Формируется рекомендация по повторению темы.</li>
            </ol>
            <strong>Итог сохраняется в прогрессе.</strong>
          </section>

          <section className={styles.important}>
            <h2>Важно</h2>
            <p>ИИ помогает оценить ответ и дать обратную связь; результат можно дополнительно пересмотреть.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default function Activity({ loaderData }: Route.ComponentProps) {
  return (
    <RequireAuth>
      <AppShell>
        {loaderData.kind === "quiz" ? (
          <QuizView activity={loaderData.activity} subject={loaderData.subject} module={loaderData.module} />
        ) : (
          <FreeAnswerView activity={loaderData.activity} subject={loaderData.subject} module={loaderData.module} />
        )}
      </AppShell>
    </RequireAuth>
  );
}
