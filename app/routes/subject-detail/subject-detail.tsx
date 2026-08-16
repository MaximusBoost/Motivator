import { Link } from "react-router";
import clsx from "clsx";

import type { Route } from "./+types/subject-detail";
import { AppShell } from "~/components/AppShell/AppShell";
import { learningRepository } from "~/data/learning";
import type { ProgressStatus } from "~/data/types";
import { getCurrentUserId } from "~/features/auth/AuthProvider";
import { RequireAuth } from "~/features/auth/RequireAuth";
import { Button } from "~/secondApp/components/Button/Button";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";

import styles from "./subject-detail.module.scss";

const statusLabels: Record<ProgressStatus, string> = {
  completed: "Завершено",
  in_progress: "В процессе",
  not_started: "Не начато",
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Предмет подготовки | Motivator" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const subject = await learningRepository.getSubjectBySlug(
    params.subjectSlug,
    await getCurrentUserId(),
  );
  if (!subject) throw new Response("Предмет не найден", { status: 404 });
  return subject;
}

export default function SubjectDetail({ loaderData: subject }: Route.ComponentProps) {
  const nextModule =
    subject.modules.find((module) => module.status === "in_progress") ??
    subject.modules.find((module) => module.status === "not_started") ??
    subject.modules.at(-1);

  const questionCount = subject.modules.reduce(
    (total, module) => total + module.activities.reduce(
      (count, activity) => count + (activity.type === "quiz" ? activity.questions.length : 0),
      0,
    ),
    0,
  );
  const freeAnswerCount = subject.modules.reduce(
    (total, module) => total + module.activities.filter((activity) => activity.type === "free_answer").length,
    0,
  );

  return (
    <RequireAuth>
      <AppShell>
        <main className={styles.page}>
          <Link className={styles.back} to="/subjects">← Все предметы</Link>

          <section className={styles.summaryCard}>
            <div className={clsx(styles.subjectIcon, styles[subject.theme])} aria-hidden="true">
              {subject.title.charAt(0)}
            </div>
            <div className={styles.summaryCopy}>
              <h1>{subject.title}</h1>
              <p>{subject.modules.length} модулей • теория, тесты и развернутые ответы</p>
              <div className={styles.progressRow}>
                <ProgressTrack value={subject.progressPercent} color={subject.theme} />
                <strong>{subject.progressPercent}% освоено</strong>
              </div>
            </div>
            {nextModule && <Button text="Продолжить" to={`/modules/${nextModule.id}`} />}
          </section>

          <h2 className={styles.modulesTitle}>Модули</h2>
          <div className={styles.contentGrid}>
            <section className={styles.moduleList} aria-label="Модули предмета">
              {subject.modules.map((module) => (
                <Link className={styles.moduleCard} key={module.id} to={`/modules/${module.id}`}>
                  <span className={styles.moduleNumber}>{String(module.number).padStart(2, "0")}</span>
                  <span className={styles.moduleCopy}>
                    <strong>{module.title}</strong>
                    <small>{module.summary}</small>
                  </span>
                  <span className={clsx(styles.status, styles[module.status])}>
                    {statusLabels[module.status]}
                  </span>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </Link>
              ))}
            </section>

            <aside className={styles.aside}>
              <section className={styles.infoCard}>
                <h2>О предмете</h2>
                <dl>
                  <div><dt>{subject.modules.length}</dt><dd>модулей</dd></div>
                  <div><dt>{questionCount}</dt><dd>тестовых вопросов</dd></div>
                  <div><dt>{freeAnswerCount}</dt><dd>свободных ответов</dd></div>
                  <div><dt>≈ {Math.max(1, Math.round(subject.estimatedMinutes / 60))} ч</dt><dd>общая длительность</dd></div>
                </dl>
                {subject.lastScore !== null && <p>Последний результат: {subject.lastScore}%</p>}
              </section>

              {nextModule && (
                <section className={styles.nextCard}>
                  <span>Следующий шаг</span>
                  <h2>Модуль {nextModule.number}</h2>
                  <p>{nextModule.title}</p>
                  <Button text="Открыть модуль" to={`/modules/${nextModule.id}`} size="s" fullWidth />
                </section>
              )}
            </aside>
          </div>
        </main>
      </AppShell>
    </RequireAuth>
  );
}
