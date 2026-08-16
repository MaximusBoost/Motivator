import style from "./todayPlan.module.scss";
import { TodayPlanItem } from "~/data/types";
type TodayPlanProps = {
  items: TodayPlanItem[];
};

export const TodayPlan = ({ items }: TodayPlanProps) => {
  return (
    <div className={style.todayPlan}>
      <h2>План на сегодня</h2>
      <div className={style.tasksWrapper}>
        {items.map((task) => (
          <div className={style.taskWrapper}>
            <label>
              <input type="checkbox" name="subscribe" checked></input>
              <h3 className={style.title}>{task.title}</h3>
              <p className={style.estimatedMinutes}>
                {task.estimatedMinutes} минут
              </p>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
