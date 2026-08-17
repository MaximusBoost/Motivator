import { useEffect, useState, type FormEvent } from "react";

import type { Route } from "./+types/practice";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import type { PracticeCategory, PracticeResult, TargetGrade } from "~/data/types";
import { getCurrentUserId, useAuth } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";

import styles from "./practice.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Практика и физподготовка | Motivator" }];
}

export async function clientLoader() {
  const userId = await getCurrentUserId();
  const [subjects, results, advice] = await Promise.all([
    learningRepository.getSubjects(userId),
    learningRepository.getPracticeResults(userId),
    learningRepository.getPhysicalTrainingAdvice(userId),
  ]);
  return { subjects, results, advice };
}

export default function Practice({ loaderData: { subjects, results: initialResults, advice: initialAdvice } }: Route.ComponentProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<PracticeCategory>("professional");
  const [results, setResults] = useState<PracticeResult[]>(initialResults);
  const [advice, setAdvice] = useState(initialAdvice);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingAdvice, setIsRequestingAdvice] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setStatus("");
    setIsSaving(true);

    try {
      const result = await learningRepository.savePracticeResult(
        {
          category,
          subjectId: category === "professional" && form.get("subjectId")
            ? String(form.get("subjectId"))
            : null,
          title: String(form.get("title")),
          value: Number(form.get("value")),
          unit: String(form.get("unit")),
          grade: Number(form.get("grade")) as TargetGrade,
          performedAt: String(form.get("performedAt")),
          notes: String(form.get("notes") ?? "") || null,
        },
        user.id,
      );
      setResults((current) => [result, ...current]);
      if (result.category === "physical") setAdvice(null);
      formElement.reset();
      setStatus(result.category === "physical"
        ? "Результат сохранён. AI-рекомендация формируется."
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
      const nextAdvice = await learningRepository.requestPhysicalTrainingAdvice(
        latestPhysical.id,
        user.id,
      );
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
              <p>Вносите выполненные упражнения и оценки вручную. Эти данные не являются официальными.</p>
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
                    name="category"
                    value="professional"
                    checked={category === "professional"}
                    onChange={() => setCategory("professional")}
                  />
                  Практический
                </label>
                <label className={category === "physical" ? styles.activeSegment : ""}>
                  <input
                    type="radio"
                    name="category"
                    value="physical"
                    checked={category === "physical"}
                    onChange={() => setCategory("physical")}
                  />
                  Физподготовка
                </label>
              </div>

              {category === "professional" && (
                <label className={styles.field}>
                  <span>Предмет</span>
                  <select name="subjectId" defaultValue="">
                    <option value="">Общая практика</option>
                    {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
                  </select>
                </label>
              )}

              <label className={styles.field}>
                <span>Норматив или упражнение</span>
                <input name="title" placeholder="Например: бег 3 км" maxLength={160} required />
              </label>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span>Результат</span>
                  <input name="value" type="number" min="0" step="0.001" placeholder="12.4" required />
                </label>
                <label className={styles.field}>
                  <span>Единица</span>
                  <input name="unit" placeholder="мин, сек, баллы" maxLength={40} required />
                </label>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span>Самооценка</span>
                  <select name="grade" defaultValue="3" required>
                    <option value="5">5 — отлично</option>
                    <option value="4">4 — хорошо</option>
                    <option value="3">3 — удовлетворительно</option>
                    <option value="2">2 — не выполнено</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Дата выполнения</span>
                  <input
                    name="performedAt"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    max={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>Заметка (необязательно)</span>
                <textarea name="notes" rows={3} maxLength={1000} placeholder="Самочувствие, условия, что улучшить…" />
              </label>

              {(error || status) && (
                <p className={error ? styles.error : styles.status} role={error ? "alert" : "status"}>
                  {error || status}
                </p>
              )}
              <Button text={isSaving ? "Сохраняем…" : "Добавить результат"} type="submit" disabled={isSaving} fullWidth />
            </form>

            <div className={styles.contentColumn}>
              <section className={styles.advice}>
                <div className={styles.aiMark}>{activeAdvice?.source === "demo_algorithm" ? "D" : "AI"}</div>
                <div>
                  <span>{activeAdvice?.source === "demo_algorithm" ? "Демо-алгоритм" : "AI-помощник по подготовке"}</span>
                  <h2>{latestPhysical ? `Последняя оценка: ${latestPhysical.grade}` : "Нужен первый результат"}</h2>
                  <p>
                    {activeAdvice?.summary ?? (latestPhysical
                      ? "Результат сохранён. Сервер формирует персональную рекомендацию; если AI ещё не настроен, данные останутся в журнале."
                      : "Добавьте первый результат физической подготовки, чтобы получить рекомендацию.")}
                  </p>
                  {activeAdvice && (
                    <ul>
                      {activeAdvice.recommendations.map((recommendation) => (
                        <li key={recommendation}>{recommendation}</li>
                      ))}
                    </ul>
                  )}
                  <small>
                    {activeAdvice?.caution ?? "AI не ставит диагнозы и не заменяет специалиста или официальный план подготовки."}
                  </small>
                  {latestPhysical && !activeAdvice && (
                    <div className={styles.adviceAction}>
                      <Button
                        text={isRequestingAdvice ? "Формируем…" : "Запросить рекомендацию ещё раз"}
                        type="button"
                        variant="secondary"
                        disabled={isRequestingAdvice}
                        onClick={() => void requestAdvice()}
                      />
                    </div>
                  )}
                </div>
              </section>

              <section className={styles.history} aria-labelledby="history-title">
                <div className={styles.historyHeading}>
                  <h2 id="history-title">История результатов</h2>
                  <span>{results.length}</span>
                </div>
                {results.length === 0 ? (
                  <div className={styles.empty}>Пока нет результатов. Добавьте первое выполненное упражнение.</div>
                ) : (
                  <div className={styles.resultList}>
                    {results.map((result) => (
                      <article key={result.id}>
                        <div className={styles.resultIcon}>{result.category === "physical" ? "Ф" : "П"}</div>
                        <div className={styles.resultCopy}>
                          <span>{result.category === "physical" ? "Физподготовка" : "Практический результат"}</span>
                          <h3>{result.title}</h3>
                          <p>
                            {result.value} {result.unit} · {new Intl.DateTimeFormat("ru-RU").format(new Date(`${result.performedAt}T00:00:00`))}
                          </p>
                          {result.notes && <small>{result.notes}</small>}
                        </div>
                        <strong className={styles.resultGrade}>{result.grade}</strong>
                        <button
                          className={styles.deleteButton}
                          type="button"
                          onClick={() => void deleteResult(result.id)}
                          disabled={deletingId === result.id}
                          aria-label={`Удалить результат «${result.title}»`}
                        >
                          {deletingId === result.id ? "…" : "×"}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          <aside className={styles.disclaimer}>
            Не указывайте подразделение, ВУС, точное место выполнения и иные служебные сведения. Самостоятельно внесённые данные используются только для учебного прогноза.
          </aside>
        </main>
      </AppShell>
    </RequireAuth>
  );
}
