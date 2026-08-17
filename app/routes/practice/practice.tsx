import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { Route } from "./+types/practice";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import {
  assessPhysicalResults,
  buildPhysicalTrainingProgram,
  calculatePhysicalExerciseScore,
  formatPhysicalResult,
  parsePhysicalResult,
  physicalExercises,
  physicalQualificationLabels,
  physicalQualityLabels,
} from "~/data/physical-training-policy";
import type {
  PhysicalAssessmentCategory,
  PhysicalExerciseId,
  PhysicalProfile,
  PhysicalQualificationLevel,
  PhysicalSex,
  PracticeCategory,
  PracticeResult,
  TargetGrade,
} from "~/data/types";
import { getCurrentUserId, useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";

import styles from "./practice.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Практика и физподготовка | Motivator" }];
}

export async function clientLoader() {
  const userId = await getCurrentUserId();
  const [subjects, results, advice, qualificationProfile, physicalProfile] = await Promise.all([
    learningRepository.getSubjects(userId),
    learningRepository.getPracticeResults(userId),
    learningRepository.getPhysicalTrainingAdvice(userId),
    learningRepository.getQualificationProfile(userId),
    learningRepository.getPhysicalProfile(userId),
  ]);
  return { subjects, results, advice, qualificationProfile, physicalProfile };
}

function maxBirthDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date.toISOString().slice(0, 10);
}

export default function Practice({
  loaderData: {
    subjects,
    results: initialResults,
    advice: initialAdvice,
    qualificationProfile,
    physicalProfile,
  },
}: Route.ComponentProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<PracticeCategory>("professional");
  const [results, setResults] = useState<PracticeResult[]>(initialResults);
  const [advice, setAdvice] = useState(initialAdvice);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingAdvice, setIsRequestingAdvice] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<PhysicalExerciseId>("push_ups");
  const [physicalResult, setPhysicalResult] = useState("");
  const [sex, setSex] = useState<PhysicalSex>(physicalProfile?.sex ?? "male");
  const [birthDate, setBirthDate] = useState(physicalProfile?.birthDate ?? "");
  const [assessmentCategory, setAssessmentCategory] = useState<PhysicalAssessmentCategory>(
    physicalProfile?.assessmentCategory ?? 3,
  );
  const [targetLevel, setTargetLevel] = useState<PhysicalQualificationLevel>(
    physicalProfile?.targetLevel ?? "third",
  );
  const [physicalPerformedAt, setPhysicalPerformedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const selectedExercise = physicalExercises.find((exercise) => exercise.id === exerciseId)
    ?? physicalExercises[0];
  const scorePreview = useMemo(() => {
    if (!qualificationProfile || !birthDate || !physicalResult) return null;
    const resultValue = parsePhysicalResult(exerciseId, physicalResult);
    if (resultValue === null) return null;
    try {
      return calculatePhysicalExerciseScore({
        exerciseId,
        resultValue,
        birthDate,
        sex,
        assessmentCategory,
        serviceType: qualificationProfile.serviceType,
        performedAt: physicalPerformedAt,
      });
    } catch {
      return null;
    }
  }, [assessmentCategory, birthDate, exerciseId, physicalPerformedAt, physicalResult, qualificationProfile, sex]);

  const activePhysicalProfile = useMemo<PhysicalProfile | null>(() => {
    if (!user || !birthDate) return null;
    return {
      userId: user.id,
      sex,
      birthDate,
      assessmentCategory,
      targetLevel,
      policyVersion: physicalProfile?.policyVersion ?? "local-preview",
      updatedAt: physicalProfile?.updatedAt ?? new Date().toISOString(),
    };
  }, [assessmentCategory, birthDate, physicalProfile, sex, targetLevel, user]);

  const physicalAssessment = useMemo(() => {
    if (!activePhysicalProfile || !qualificationProfile) return null;
    try {
      return assessPhysicalResults(activePhysicalProfile, qualificationProfile.serviceType, results);
    } catch {
      return null;
    }
  }, [activePhysicalProfile, qualificationProfile, results]);
  const trainingProgram = useMemo(
    () => activePhysicalProfile && physicalAssessment
      ? buildPhysicalTrainingProgram(activePhysicalProfile, physicalAssessment, results)
      : null,
    [activePhysicalProfile, physicalAssessment, results],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setStatus("");
    setIsSaving(true);

    try {
      let result: PracticeResult;
      if (category === "physical") {
        if (!qualificationProfile) {
          throw new Error("Сначала настройте маршрут: вид службы нужен для расчёта нормативов.");
        }
        const resultValue = parsePhysicalResult(exerciseId, physicalResult);
        if (resultValue === null) {
          throw new Error(`Введите результат в правильном формате. ${selectedExercise.inputHint}`);
        }
        const score = calculatePhysicalExerciseScore({
          exerciseId,
          resultValue,
          birthDate,
          sex,
          assessmentCategory,
          serviceType: qualificationProfile.serviceType,
          performedAt: physicalPerformedAt,
        });
        await learningRepository.savePhysicalProfile(
          { sex, birthDate, assessmentCategory, targetLevel },
          user.id,
        );
        result = await learningRepository.savePracticeResult(
          {
            category: "physical",
            subjectId: null,
            title: selectedExercise.title,
            value: resultValue,
            unit: selectedExercise.unit,
            grade: score.grade,
            performedAt: physicalPerformedAt,
            notes: String(form.get("notes") ?? "") || null,
            physicalExerciseId: exerciseId,
            physicalQuality: selectedExercise.quality,
            points: score.points,
            ageGroup: score.ageGroup,
          },
          user.id,
        );
        setPhysicalResult("");
      } else {
        result = await learningRepository.savePracticeResult(
          {
            category: "professional",
            subjectId: form.get("subjectId") ? String(form.get("subjectId")) : null,
            title: String(form.get("title")),
            value: Number(form.get("value")),
            unit: String(form.get("unit")),
            grade: Number(form.get("grade")) as TargetGrade,
            performedAt: String(form.get("performedAt")),
            notes: String(form.get("notes") ?? "") || null,
          },
          user.id,
        );
        formElement.reset();
      }
      setResults((current) => [result, ...current]);
      if (result.category === "physical") setAdvice(null);
      setStatus(result.category === "physical"
        ? `Результат сохранён: ${result.points ?? 0} баллов, предварительная оценка ${result.grade}.`
        : "Результат добавлен в маршрут.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось сохранить результат.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteResult(resultId: string) {
    if (!user) return;
    setDeletingId(resultId);
    setError("");
    try {
      await learningRepository.deletePracticeResult(resultId, user.id);
      setResults((current) => current.filter((result) => result.id !== resultId));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось удалить результат.");
    } finally {
      setDeletingId(null);
    }
  }

  const latestPhysical = results.find((result) => result.category === "physical");
  const activeAdvice = advice?.basedOnResultId === latestPhysical?.id ? advice : null;

  useEffect(() => {
    if (!user || !latestPhysical || activeAdvice) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const nextAdvice = await learningRepository.getPhysicalTrainingAdvice(user.id);
        if (!cancelled && nextAdvice?.basedOnResultId === latestPhysical.id) {
          setAdvice(nextAdvice);
          return;
        }
      } catch {
        // Результат сохранён даже при временно недоступном AI-провайдере.
      }
      if (!cancelled && attempts < 12) timeoutId = setTimeout(() => void poll(), 2500);
    };

    timeoutId = setTimeout(() => void poll(), 1000);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeAdvice, latestPhysical, user]);

  async function requestAdvice() {
    if (!user || !latestPhysical) return;
    setIsRequestingAdvice(true);
    setError("");
    setStatus("");
    try {
      const nextAdvice = await learningRepository.requestPhysicalTrainingAdvice(latestPhysical.id, user.id);
      if (nextAdvice?.basedOnResultId === latestPhysical.id) {
        setAdvice(nextAdvice);
        setStatus("AI-рекомендация готова.");
      } else {
        setStatus("Рекомендация формируется. Страница обновит её автоматически.");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось получить рекомендацию.");
    } finally {
      setIsRequestingAdvice(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header className={styles.header}>
            <div>
              <span>Самостоятельный журнал</span>
              <h1>Практика и физическая подготовка</h1>
              <p>Результаты физических упражнений переводятся в баллы автоматически по НФП-2023.</p>
            </div>
            <Button text="Открыть маршрут" to="/qualification" variant="secondary" />
          </header>

          <div className={styles.layout}>
            <form className={styles.formCard} onSubmit={handleSubmit}>
              <h2>Добавить результат</h2>
              <div className={styles.segmented}>
                <label className={category === "professional" ? styles.activeSegment : ""}>
                  <input
                    type="radio"
                    name="practiceCategory"
                    value="professional"
                    checked={category === "professional"}
                    onChange={() => setCategory("professional")}
                  />
                  Практический
                </label>
                <label className={category === "physical" ? styles.activeSegment : ""}>
                  <input
                    type="radio"
                    name="practiceCategory"
                    value="physical"
                    checked={category === "physical"}
                    onChange={() => setCategory("physical")}
                  />
                  Физподготовка
                </label>
              </div>

              {category === "professional" ? (
                <>
                  <label className={styles.field}>
                    <span>Предмет</span>
                    <select name="subjectId" defaultValue="">
                      <option value="">Общая практика</option>
                      {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Норматив или упражнение</span>
                    <input name="title" placeholder="Например: практическая отработка" maxLength={160} required />
                  </label>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}><span>Результат</span><input name="value" type="number" min="0" step="0.001" required /></label>
                    <label className={styles.field}><span>Единица</span><input name="unit" placeholder="сек, баллы, раз" maxLength={40} required /></label>
                  </div>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span>Самооценка</span>
                      <select name="grade" defaultValue="3" required>
                        <option value="5">5 — отлично</option><option value="4">4 — хорошо</option>
                        <option value="3">3 — удовлетворительно</option><option value="2">2 — не выполнено</option>
                      </select>
                    </label>
                    <label className={styles.field}><span>Дата выполнения</span><input name="performedAt" type="date" defaultValue={physicalPerformedAt} max={physicalPerformedAt} required /></label>
                  </div>
                </>
              ) : qualificationProfile ? (
                <>
                  <div className={styles.profileNote}>
                    Расчёт для службы {qualificationProfile.serviceType === "contract" ? "по контракту" : "по призыву"}.
                    Категорию № 1–3 выбирайте по официальному отнесению вашей должности или подразделения.
                  </div>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span>Пол</span>
                      <select value={sex} onChange={(event) => setSex(event.target.value as PhysicalSex)}><option value="male">Мужской</option><option value="female">Женский</option></select>
                    </label>
                    <label className={styles.field}><span>Дата рождения</span><input type="date" value={birthDate} max={maxBirthDate()} onChange={(event) => setBirthDate(event.target.value)} required /></label>
                  </div>
                  <label className={styles.field}>
                    <span>Категория физической подготовки</span>
                    <select value={assessmentCategory} onChange={(event) => setAssessmentCategory(Number(event.target.value) as PhysicalAssessmentCategory)}>
                      <option value="1">Категория № 1</option><option value="2">Категория № 2</option><option value="3">Категория № 3</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Целевой квалификационный уровень</span>
                    <select value={targetLevel} onChange={(event) => setTargetLevel(event.target.value as PhysicalQualificationLevel)}>
                      <option value="third">Третий</option><option value="second">Второй</option>
                      <option value="first">Первый</option><option value="highest">Высший</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Упражнение</span>
                    <select value={exerciseId} onChange={(event) => setExerciseId(event.target.value as PhysicalExerciseId)}>
                      {physicalExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.title}</option>)}
                    </select>
                  </label>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span>Результат</span>
                      <input value={physicalResult} onChange={(event) => setPhysicalResult(event.target.value)} placeholder={selectedExercise.placeholder} inputMode="decimal" required />
                      <small>{selectedExercise.inputHint}</small>
                    </label>
                    <label className={styles.field}><span>Дата выполнения</span><input type="date" value={physicalPerformedAt} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setPhysicalPerformedAt(event.target.value)} required /></label>
                  </div>
                  <div className={styles.scorePreview} aria-live="polite">
                    <div><span>Качество</span><strong>{physicalQualityLabels[selectedExercise.quality]}</strong></div>
                    <div><span>Баллы</span><strong>{scorePreview?.points ?? "—"}</strong></div>
                    <div><span>Оценка упражнения</span><strong>{scorePreview?.grade ?? "—"}</strong></div>
                    <div><span>Возрастная группа</span><strong>{scorePreview ? `№ ${scorePreview.ageGroup}` : "—"}</strong></div>
                  </div>
                </>
              ) : (
                <div className={styles.profileMissing}>
                  <strong>Нужен профиль маршрута</strong><p>Вид службы входит в нормативный расчёт физподготовки.</p>
                  <Button text="Настроить маршрут" to="/onboarding" size="s" />
                </div>
              )}

              {(category === "professional" || qualificationProfile) && (
                <label className={styles.field}><span>Заметка (необязательно)</span><textarea name="notes" rows={3} maxLength={1000} placeholder="Самочувствие, условия, что улучшить…" /></label>
              )}
              {(error || status) && <p className={error ? styles.error : styles.status} role={error ? "alert" : "status"}>{error || status}</p>}
              {(category === "professional" || qualificationProfile) && <Button text={isSaving ? "Сохраняем…" : "Добавить результат"} type="submit" disabled={isSaving} fullWidth />}
            </form>

            <div className={styles.contentColumn}>
              {trainingProgram && physicalAssessment && (
                <section className={styles.program} aria-labelledby="program-title">
                  <div className={styles.programHeading}>
                    <div><span>Условная программа на {trainingProgram.durationWeeks} недель</span><h2 id="program-title">{trainingProgram.title}</h2></div>
                    <strong>{physicalAssessment.progressPercent}% к цели</strong>
                  </div>
                  <p>{trainingProgram.rationale}</p>
                  <div className={styles.assessmentSummary}>
                    <span>{physicalAssessment.sumPoints} баллов</span>
                    <span>{physicalAssessment.countedExerciseCount} из {physicalAssessment.requiredExerciseCount} качеств</span>
                    <span>{physicalAssessment.preliminaryLevel ? physicalQualificationLabels[physicalAssessment.preliminaryLevel] : "Уровень пока не определён"}</span>
                  </div>
                  <div className={styles.sessionList}>
                    {trainingProgram.weeklySessions.map((session) => (
                      <article key={`${session.day}-${session.title}`}><span>{session.day}</span><h3>{session.title}</h3><p>{session.details}</p><small>{session.intensity}</small></article>
                    ))}
                  </div>
                  <details><summary>Как увеличивать нагрузку</summary><ol>{trainingProgram.progression.map((step) => <li key={step}>{step}</li>)}</ol></details>
                  <small className={styles.programCaution}>{trainingProgram.caution}</small>
                </section>
              )}

              <section className={styles.advice}>
                <div className={styles.aiMark}>{activeAdvice?.source === "demo_algorithm" ? "D" : "AI"}</div>
                <div>
                  <span>{activeAdvice?.source === "demo_algorithm" ? "Демо-анализ" : "Дополнительная AI-рекомендация"}</span>
                  <h2>{latestPhysical ? `Последний результат: оценка ${latestPhysical.grade}` : "Нужен первый результат"}</h2>
                  <p>{activeAdvice?.summary ?? (latestPhysical ? "Результат сохранён. Можно запросить дополнительный комментарий." : "Добавьте первый результат физической подготовки.")}</p>
                  {activeAdvice && <ul>{activeAdvice.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul>}
                  <small>{activeAdvice?.caution ?? "AI не ставит диагнозы и не заменяет специалиста или официальный план подготовки."}</small>
                  {latestPhysical && !activeAdvice && <div className={styles.adviceAction}><Button text={isRequestingAdvice ? "Формируем…" : "Запросить рекомендацию"} type="button" variant="secondary" disabled={isRequestingAdvice} onClick={() => void requestAdvice()} /></div>}
                </div>
              </section>

              <section className={styles.history} aria-labelledby="history-title">
                <div className={styles.historyHeading}><h2 id="history-title">История результатов</h2><span>{results.length}</span></div>
                {results.length === 0 ? <div className={styles.empty}>Пока нет результатов.</div> : (
                  <div className={styles.resultList}>
                    {results.map((result) => (
                      <article key={result.id}>
                        <div className={styles.resultIcon}>{result.category === "physical" ? "Ф" : "П"}</div>
                        <div className={styles.resultCopy}>
                          <span>{result.category === "physical" ? "Физподготовка" : "Практический результат"}</span>
                          <h3>{result.title}</h3>
                          <p>
                            {result.physicalExerciseId ? formatPhysicalResult(result.physicalExerciseId, result.value) : `${result.value} ${result.unit}`}
                            {result.points !== null && result.points !== undefined ? ` · ${result.points} баллов` : ""}
                            {` · ${new Intl.DateTimeFormat("ru-RU").format(new Date(`${result.performedAt}T00:00:00`))}`}
                          </p>
                          {result.notes && <small>{result.notes}</small>}
                        </div>
                        <strong className={styles.resultGrade}>{result.grade}</strong>
                        <button className={styles.deleteButton} type="button" onClick={() => void deleteResult(result.id)} disabled={deletingId === result.id} aria-label={`Удалить результат «${result.title}»`}>
                          {deletingId === result.id ? "…" : "×"}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* <aside className={styles.disclaimer}>
            Баллы и предварительный уровень — учебный самоконтроль. Официальный результат определяется на проверке по назначенному контрольному комплексу. Не указывайте подразделение, ВУС и место выполнения.
          </aside> */}
        </main>
      </AppShell>
    </RequireAuth>
  );
}
