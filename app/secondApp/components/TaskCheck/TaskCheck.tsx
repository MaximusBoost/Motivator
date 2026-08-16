import type { TodayPlanItem } from "~/data/types";

import styles from "./taskCheck.module.scss";

type TaskCheckProps = {
  task: TodayPlanItem;
  onToggle: (taskId: string, isCompleted: boolean) => void;
};

export function TaskCheck({ task, onToggle }: TaskCheckProps) {
  return (
    <label className={styles.task}>
      <input
        className={styles.checkbox}
        type="checkbox"
        name="today-plan"
        checked={task.isCompleted}
        onChange={(event) => onToggle(task.id, event.target.checked)}
      />

      <span className={styles.content}>
        <span className={styles.title}>{task.title}</span>
        <span className={styles.minutes}>{task.estimatedMinutes} мин</span>
      </span>
    </label>
  );
}
