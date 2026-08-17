import { useMemo, useState } from "react";

import type { Route } from "./+types/goals";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import { getSubjectImage } from "~/data/subject-images";
import type { TargetGrade } from "~/data/types";
import { getCurrentUserId, useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";

import styles from "./goals.module.scss";

const scoreThresholds: Record<TargetGrade, number> = {
  2: 0,
  3: 60,
  4: 75,
  5: 90,
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Мои цели | Motivator" }];
}

export async function clientLoader() {
  const userId = await getCurrentUserId();
  const [subjects, goals] = await Promise.all([
    learningRepository.getSubjects(userId),
    learningRepository.getGoals(userId),
  ]);
  return { subjects, goals };
}

export default function Goals({ loaderData: { subjects, goals } }: Route.ComponentProps) {
  const { user } = useAuth();
  const initialTargets = useMemo(
    () => Object.fromEntries(goals.map((goal) => [goal.subjectId, goal.targetGrade])) as Record<string, TargetGrade>,
    [goals],
  );
  const [targets, setTargets] = useState<Record<string, TargetGrade>>(initialTargets);
  const [savedTargets, setSavedTargets] = useState<Record<string, TargetGrade>>(initialTargets);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedGoals = Object.entries(targets) as [string, TargetGrade][];
  const hasChanges = subjects.some((subject) => targets[subject.id] !== savedTargets[subject.id]);

  async function saveGoals() {
    if (!user) return;
    if (selectedGoals.length === 0) {
      setError("Выберите хотя бы одну цель.");
      return;
    }

    setIsSaving(true);
    setError("");
    setStatus("");
    try {
      await Promise.all(
        selectedGoals
          .filter(([subjectId, grade]) => savedTargets[subjectId] !== grade)
          .map(([subjectId, grade]) => learningRepository.setGoal(subjectId, grade, user.id)),
      );
      setSavedTargets({ ...targets });
      setStatus("Цели сохранены.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось сохранить цели.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header className={styles.header}>
            <div>
              <h1>Мои цели</h1>
              <p>Выберите желаемую итоговую оценку по каждому предмету.</p>
            </div>
            <Button
              text={isSaving ? "Сохраняем…" : "Сохранить цели"}
              onClick={saveGoals}
              disabled={isSaving || !hasChanges}
            />
          </header>

          {(status || error) && (
            <p className={error ? styles.error : styles.success} role={error ? "alert" : "status"}>
              {error || status}
            </p>
          )}

          <section className={styles.explanation}>
            <h2>Как считается достижение цели</h2>
            <p>Оценка 5 — от 90%, 4 — от 75%, 3 — от 60%, 2 — результат ниже 60%. Порог можно будет сделать настраиваемым после MVP.</p>
          </section>

          <section className={styles.grid} aria-label="Цели по предметам">
            {subjects.map((subject) => {
              const target = targets[subject.id];
              const threshold = target ? scoreThresholds[target] : 0;
              const score = subject.lastScore;
              const goalProgress = target && score !== null
                ? threshold === 0 ? 100 : Math.min(100, Math.round(score * 100 / threshold))
                : 0;
              const achieved = target !== undefined && score !== null && score >= threshold;
              const subjectImage = getSubjectImage(subject.id);

              return (
                <article className={styles.goalCard} key={subject.id}>
                  <div className={styles.goalHeading}>
                    {subjectImage ? (
                      <img src={subjectImage} alt="" aria-hidden="true" />
                    ) : null}
                    <div>
                      <h2>{subject.title}</h2>
                      <p>{score === null ? "Результатов пока нет" : `Текущий результат: ${score}%`}</p>
                    </div>
                  </div>

                  <label>
                    <span>Целевая оценка</span>
                    <select
                      value={target ?? ""}
                      onChange={(event) => {
                        const value = Number(event.target.value) as TargetGrade;
                        setTargets((current) => ({ ...current, [subject.id]: value }));
                        setStatus("");
                      }}
                    >
                      <option value="" disabled>Выберите оценку</option>
                      <option value="5">5 — отлично</option>
                      <option value="4">4 — хорошо</option>
                      <option value="3">3 — удовлетворительно</option>
                      <option value="2">2 — базовая цель</option>
                    </select>
                  </label>

                  <div className={styles.goalProgress}>
                    <div>
                      <span>{target ? `До цели «${target}»` : "Цель не выбрана"}</span>
                      <strong>{target ? `${goalProgress}%` : "—"}</strong>
                    </div>
                    <ProgressTrack value={goalProgress} color={achieved ? "success" : subject.theme} />
                  </div>

                  {target && (
                    <p className={achieved ? styles.achieved : styles.pending}>
                      {achieved ? "Цель достигнута" : `Нужно набрать ${threshold}% или больше`}
                    </p>
                  )}
                </article>
              );
            })}
          </section>
        </main>
      </AppShell>
    </RequireAuth>
  );
}
