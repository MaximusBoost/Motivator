import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import clsx from "clsx";

import type { LearningModule, Subject } from "~/data/types";
import { ProgressTrack } from "~/secondApp/components/ProgressTrack/ProgressTrack";
import styles from "./learningShell.module.scss";

type LearningShellProps = {
  subject: Subject;
  currentModule: LearningModule;
  children: ReactNode;
};

export function LearningShell({ subject, currentModule, children }: LearningShellProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <Link className={styles.subjectName} to={`/subjects/${subject.slug}`}>
          {subject.title}
        </Link>
        <p className={styles.counter}>Модуль {currentModule.number} из {subject.modules.length}</p>
        <div className={styles.divider} />

        <nav className={styles.modules} aria-label="Модули предмета">
          {subject.modules.map((module) => (
            <NavLink
              key={module.id}
              to={`/modules/${module.id}`}
              className={clsx(styles.moduleLink, module.id === currentModule.id && styles.current)}
            >
              <span className={clsx(styles.dot, styles[module.status])} aria-hidden="true" />
              <span className={styles.number}>{String(module.number).padStart(2, "0")}</span>
              <span className={styles.moduleTitle}>{module.title}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.railProgress}>
          <span>Прогресс модуля</span>
          <ProgressTrack value={currentModule.progressPercent} />
          <strong>{currentModule.progressPercent}%</strong>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <Link to={`/subjects/${subject.slug}`}>← К предмету</Link>
        <strong>Модуль {currentModule.number} из {subject.modules.length}</strong>
      </header>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
