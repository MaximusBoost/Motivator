import type { ContinueLearning } from "~/data/types";
import { getSubjectImage } from "~/data/subject-images";

import { Button } from "../Button/Button";
import { ProgressTrack } from "../ProgressTrack/ProgressTrack";
import styles from "./continueCard.module.scss";

type ContinueCardProps = {
  item: ContinueLearning;
};

export function ContinueCard({ item }: ContinueCardProps) {
  const subjectImage = getSubjectImage(item.subjectId);

  return (
    <article className={styles.card}>
      {subjectImage ? (
        <img
          className={styles.icon}
          src={subjectImage}
          alt=""
          aria-hidden="true"
        />
      ) : null}

      <div className={styles.content}>
        <div className={styles.heading}>
          <h3>{item.subjectTitle}</h3>
          <p>
            Модуль {item.moduleNumber} из {item.modulesTotal} •{" "}
            {item.moduleTitle}
          </p>
        </div>

        <div className={styles.nextRow}>
          <div className={styles.nextTask}>
            <p className={styles.eyebrow}>Следующая задача</p>
            <p className={styles.taskTitle}>{item.nextActivityTitle}</p>
            <div className={styles.progressRow}>
              <ProgressTrack
                value={item.progressPercent}
                label={`Прогресс по предмету «${item.subjectTitle}»`}
              />
              <span>{item.progressPercent}%</span>
            </div>
          </div>

          <Button text="Продолжить" to={`/activities/${item.nextActivityId}`} />
        </div>
      </div>
    </article>
  );
}
