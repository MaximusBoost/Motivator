import type { TodayPlanItem } from "~/data/types";

import { TaskCheck } from "../TaskCheck/TaskCheck";
import styles from "./todayPlan.module.scss";

type TodayPlanProps = {
  items: readonly TodayPlanItem[];
  onToggle: (taskId: string, isCompleted: boolean) => void;
};

export const TodayPlan = ({ items, onToggle }: TodayPlanProps) => {
  return (
    <section className={styles.todayPlan} aria-labelledby="today-plan-title">
      <h2 className={styles.heading} id="today-plan-title">
        План на сегодня
      </h2>

      <div className={styles.tasksWrapper}>
        {items.map((task) => (
          <TaskCheck key={task.id} task={task} onToggle={onToggle} />
        ))}
      </div>
    </section>
  );
};
