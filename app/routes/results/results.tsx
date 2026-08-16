import { Link } from "react-router";

import type { Route } from "./+types/results";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import { getCurrentUserId } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";

import styles from "./results.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Результаты | Motivator" }];
}

export async function clientLoader() {
  return learningRepository.getResults(await getCurrentUserId());
}

export default function Results({ loaderData: results }: Route.ComponentProps) {
  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header>
            <h1>Результаты</h1>
            <p>История тестов и развернутых ответов.</p>
          </header>

          {results.length > 0 ? (
            <section className={styles.list} aria-label="История результатов">
              {results.map((result) => (
                <Link className={styles.resultCard} key={result.id} to={`/results/${result.id}`}>
                  <span className={styles.type}>
                    {result.activityType === "quiz" ? "Тест" : "Развернутый ответ"}
                  </span>
                  <strong className={styles.score}>{result.score}<small>/100</small></strong>
                  <span className={styles.status}>{result.statusLabel}</span>
                  <p>{result.summary}</p>
                  <time dateTime={result.completedAt}>
                    {new Date(result.completedAt).toLocaleDateString("ru-RU")}
                  </time>
                  <span className={styles.open}>Открыть →</span>
                </Link>
              ))}
            </section>
          ) : (
            <section className={styles.empty}>
              <h2>Результатов пока нет</h2>
              <p>Пройдите первый тест или отправьте развернутый ответ.</p>
              <Link to="/subjects">Перейти к предметам →</Link>
            </section>
          )}
        </main>
      </AppShell>
    </RequireAuth>
  );
}
