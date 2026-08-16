import { Link } from "react-router";

import type { Route } from "./+types/progress";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import { getCurrentUserId } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";
import { StatCard } from "~/secondApp/components/StatCard/StatCard";

import styles from "./progress.module.scss";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Прогресс | Motivator" }];
}

export async function clientLoader() {
  return learningRepository.getSubjects(await getCurrentUserId());
}

export default function Progress({ loaderData: subjects }: Route.ComponentProps) {
  const modules = subjects.flatMap((subject) => subject.modules);
  const overallProgress = subjects.length > 0
    ? Math.round(subjects.reduce((sum, subject) => sum + subject.progressPercent, 0) / subjects.length)
    : 0;
  const startedModules = modules.filter((module) => module.status !== "not_started").length;
  const completedModules = modules.filter((module) => module.status === "completed").length;

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <header className={styles.header}>
            <h1>Учебный прогресс</h1>
            <p>Сводка по предметам и модулям обновляется после каждого выполненного действия.</p>
          </header>

          <section className={styles.stats} aria-label="Общий прогресс">
            <StatCard value={`${overallProgress}%`} label="Общий прогресс" />
            <StatCard value={startedModules} label="Модулей начато" />
            <StatCard value={completedModules} label="Модулей завершено" />
            <StatCard value={modules.length} label="Всего модулей" />
          </section>

          <section className={styles.subjects} aria-labelledby="progress-subjects-title">
            <h2 id="progress-subjects-title">Прогресс по предметам</h2>
            <div className={styles.subjectList}>
              {subjects.map((subject) => {
                const completed = subject.modules.filter((module) => module.status === "completed").length;
                return (
                  <article className={styles.subject} key={subject.id}>
                    <div className={styles.subjectHeading}>
                      <div>
                        <span>{subject.code}</span>
                        <div>
                          <h3>{subject.title}</h3>
                          <p>{completed} из {subject.modules.length} модулей завершено</p>
                        </div>
                      </div>
                      <strong>{subject.progressPercent}%</strong>
                    </div>
                    <ProgressTrack value={subject.progressPercent} color={subject.theme} />

                    <details className={styles.moduleDetails}>
                      <summary>Показать модули</summary>
                      <div>
                        {subject.modules.map((module) => (
                          <Link key={module.id} to={`/modules/${module.id}`}>
                            <span>{String(module.number).padStart(2, "0")} • {module.title}</span>
                            <strong>{module.progressPercent}%</strong>
                          </Link>
                        ))}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </AppShell>
    </RequireAuth>
  );
}
