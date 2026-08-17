import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import type { Route } from "./+types/qualification-exam";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import { qualificationLabels } from "~/data/qualification-policy";
import { getSubjectImage } from "~/data/subject-images";
import type { QualificationExam as QualificationExamData } from "~/data/types";
import { getCurrentUserId, useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";

import styles from "./qualification-exam.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Пробное испытание | Motivator" }];
}

export async function clientLoader() {
  const userId = await getCurrentUserId();
  const [subjects, profile, roadmap] = await Promise.all([
    learningRepository.getSubjects(userId),
    learningRepository.getQualificationProfile(userId),
    learningRepository.getQualificationRoadmap(userId),
  ]);
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject] as const));
  const prioritizedSubjects = roadmap.subjects
    .map((item) => subjectById.get(item.subjectId))
    .filter((subject): subject is NonNullable<typeof subject> => Boolean(subject));
  return { subjects: prioritizedSubjects, profile };
}

export default function QualificationExam({ loaderData: { subjects, profile } }: Route.ComponentProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(() => subjects.slice(0, 4).map((subject) => subject.id));
  const [exam, setExam] = useState<QualificationExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const questions = useMemo(
    () => exam?.subjects.flatMap((subject) =>
      subject.questions.map((question) => ({ subject, question }))) ?? [],
    [exam],
  );
  const current = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  function toggleSubject(subjectId: string) {
    setSelectedSubjectIds((currentIds) =>
      currentIds.includes(subjectId)
        ? currentIds.filter((id) => id !== subjectId)
        : [...currentIds, subjectId],
    );
    setError("");
  }

  async function startExam() {
    if (!user) return;
    setError("");
    setIsWorking(true);
    try {
      const nextExam = await learningRepository.createQualificationExam(selectedSubjectIds, user.id);
      setExam(nextExam);
      setAnswers({});
      setCurrentIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось сформировать испытание.");
    } finally {
      setIsWorking(false);
    }
  }

  async function submitExam() {
    if (!user || !exam) return;
    if (answeredCount !== questions.length) {
      setError("Ответьте на все вопросы перед завершением испытания.");
      return;
    }
    setError("");
    setIsWorking(true);
    try {
      const result = await learningRepository.submitQualificationExam(exam, answers, user.id);
      navigate(`/qualification/exam/results/${result.id}`, { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось проверить испытание.");
      setIsWorking(false);
    }
  }

  if (!profile) {
    return (
      <RequireAuth>
        <AppShell>
          <main className={styles.page}>
            <section className={styles.emptyState}>
              <h1>Сначала настройте персональный маршрут</h1>
              <p>Целевая классность нужна, чтобы корректно интерпретировать результат испытания.</p>
              <Button text="Выбрать цель" to="/onboarding" />
            </section>
          </main>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          {!exam ? (
            <>
              <header className={styles.header}>
                <span>Контрольный режим</span>
                <h1>Пробное квалификационное испытание</h1>
                <p>
                  Выберите не менее четырёх предметов. В каждом будет 10 вопросов без подсказок.
                  Результат даст предварительный прогноз для цели «{qualificationLabels[profile.targetQualification]}».
                </p>
              </header>

              <section className={styles.rules} aria-label="Правила испытания">
                <div><strong>10</strong><span>вопросов по предмету</span></div>
                <div><strong>9–10</strong><span>оценка «5»</span></div>
                <div><strong>8</strong><span>оценка «4»</span></div>
                <div><strong>6–7</strong><span>оценка «3»</span></div>
              </section>

              <section className={styles.selection} aria-labelledby="selection-title">
                <div className={styles.sectionHeading}>
                  <div>
                    <h2 id="selection-title">Предметы испытания</h2>
                    <p>Выбрано: {selectedSubjectIds.length}. Минимум: 4.</p>
                  </div>
                  <Button
                    text={isWorking ? "Формируем…" : "Начать испытание"}
                    onClick={startExam}
                    disabled={isWorking || selectedSubjectIds.length < 4}
                  />
                </div>

                <div className={styles.subjectGrid}>
                  {subjects.map((subject) => {
                    const selected = selectedSubjectIds.includes(subject.id);
                    const image = getSubjectImage(subject.id);
                    const questionCount = subject.modules
                      .flatMap((module) => module.activities)
                      .filter((activity) => activity.type === "quiz")
                      .reduce((total, activity) => total + activity.questions.length, 0);

                    return (
                      <label className={`${styles.subjectCard} ${selected ? styles.selected : ""}`} key={subject.id}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSubject(subject.id)}
                          disabled={!selected && questionCount < 10}
                        />
                        {image && <img src={image} alt="" aria-hidden="true" />}
                        <span>
                          <strong>{subject.title}</strong>
                          <small>{questionCount >= 10 ? "10 вопросов доступно" : "Недостаточно вопросов"}</small>
                        </span>
                        <i aria-hidden="true">{selected ? "✓" : "+"}</i>
                      </label>
                    );
                  })}
                </div>
              </section>

              <aside className={styles.notice}>
                Результат является тренировочным. Приложение не проводит официальное испытание и не присваивает классность.
              </aside>
            </>
          ) : current ? (
            <>
              <header className={styles.examHeader}>
                <div>
                  <span>{current.subject.subjectTitle}</span>
                  <h1>Вопрос {currentIndex + 1} из {questions.length}</h1>
                </div>
                <strong>{answeredCount}/{questions.length} отвечено</strong>
              </header>
              <ProgressTrack value={Math.round(answeredCount * 100 / questions.length)} />

              <section className={styles.questionCard}>
                <span className={styles.questionNumber}>Вопрос {currentIndex + 1}</span>
                <h2>{current.question.prompt}</h2>
                {current.question.instructions && <p>{current.question.instructions}</p>}

                <fieldset className={styles.options}>
                  <legend className={styles.visuallyHidden}>Варианты ответа</legend>
                  {current.question.options.map((option) => (
                    <label
                      className={answers[current.question.id] === option.id ? styles.chosenOption : ""}
                      key={option.id}
                    >
                      <input
                        type="radio"
                        name={current.question.id}
                        value={option.id}
                        checked={answers[current.question.id] === option.id}
                        onChange={() => setAnswers((currentAnswers) => ({
                          ...currentAnswers,
                          [current.question.id]: option.id,
                        }))}
                      />
                      <span>{option.label}</span>
                      <strong>{option.text}</strong>
                    </label>
                  ))}
                </fieldset>
              </section>

              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.examActions}>
                <Button
                  text="Назад"
                  variant="secondary"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0 || isWorking}
                />
                {currentIndex < questions.length - 1 ? (
                  <Button
                    text="Следующий вопрос"
                    onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
                    disabled={!answers[current.question.id]}
                  />
                ) : (
                  <Button
                    text={isWorking ? "Проверяем…" : "Завершить и проверить"}
                    onClick={submitExam}
                    disabled={isWorking || answeredCount !== questions.length}
                  />
                )}
              </div>
            </>
          ) : null}

          {error && !exam && <p className={styles.error} role="alert">{error}</p>}
        </main>
      </AppShell>
    </RequireAuth>
  );
}
