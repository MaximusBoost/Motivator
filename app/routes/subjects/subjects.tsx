import { useMemo, useState } from "react";
import clsx from "clsx";

import type { Route } from "./+types/subjects";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import type { ProgressStatus } from "~/data/types";
import { getCurrentUserId } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { SubjectCard } from "~/secondApp/components/SubjectCard/SubjectCard";

import styles from "./subjects.module.scss";

type Filter = "all" | ProgressStatus;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "in_progress", label: "В процессе" },
  { value: "completed", label: "Завершённые" },
  { value: "not_started", label: "Новые" },
];

export function meta({}: Route.MetaArgs) {
  return [{ title: "Предметы | Motivator" }];
}

export async function clientLoader() {
  return learningRepository.getSubjects(await getCurrentUserId());
}

export default function Subjects({ loaderData: subjects }: Route.ComponentProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visibleSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return subjects.filter((subject) => {
      const matchesFilter = filter === "all" || subject.status === filter;
      const matchesQuery = !normalizedQuery ||
        `${subject.title} ${subject.subtitle}`.toLocaleLowerCase("ru").includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, subjects]);

  const modulesTotal = subjects.reduce((total, subject) => total + subject.modules.length, 0);

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header className={styles.header}>
            <div>
              <h1>Предметы подготовки</h1>
              <p>Выберите направление и продолжайте с последнего пройденного модуля.</p>
            </div>

            <label className={styles.search}>
              <span aria-hidden="true" />
              <span className={styles.visuallyHidden}>Поиск по предметам</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по предметам"
              />
            </label>
          </header>

          <div className={styles.filters} aria-label="Фильтр предметов">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                className={clsx(filter === item.value && styles.activeFilter)}
                onClick={() => setFilter(item.value)}
                aria-pressed={filter === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className={styles.summary}>{subjects.length} направлений • {modulesTotal} учебных модулей</p>

          {visibleSubjects.length > 0 ? (
            <section className={styles.grid} aria-label="Каталог предметов">
              {visibleSubjects.map((subject) => <SubjectCard key={subject.id} subject={subject} />)}
            </section>
          ) : (
            <section className={styles.empty}>
              <h2>Ничего не найдено</h2>
              <p>Измените поисковый запрос или выберите другой фильтр.</p>
            </section>
          )}
        </main>
      </AppShell>
    </RequireAuth>
  );
}
