import type { Subject } from "~/data/types";
import clsx from "clsx";

import { Button } from "../Button/Button";
import { ProgressTrack } from "../ProgressTrack/ProgressTrack";
import styles from "./subjectCard.module.scss";

type SubjectCardProps = {
  subject: Subject;
};

export function SubjectCard({ subject }: SubjectCardProps) {
  return (
    <article className={styles.card}>
      <div className={clsx(styles.icon, styles[subject.theme])} aria-hidden="true">
        {subject.code}
      </div>

      <h3 className={styles.title}>{subject.title}</h3>
      <p className={styles.subtitle}>{subject.subtitle}</p>

      <div className={styles.meta}>
        <span>{subject.modules.length} модулей</span>
        <strong>{subject.progressPercent}%</strong>
      </div>

      <ProgressTrack
        value={subject.progressPercent}
        color={subject.theme}
        label={`Прогресс по предмету «${subject.title}»`}
      />
      <Button
        text={subject.progressPercent === 0 ? "Начать" : "Продолжить"}
        to={`/subjects/${subject.slug}`}
        variant="secondary"
        size="s"
        fullWidth
      />
    </article>
  );
}
