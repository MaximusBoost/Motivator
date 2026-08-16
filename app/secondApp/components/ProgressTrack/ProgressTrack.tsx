import type { CSSProperties } from "react";
import clsx from "clsx";
import styles from "./progressTrack.module.scss";

type ProgressTrackProps = {
  value: number;
  label?: string;
  color?: "blue" | "olive" | "success";
};

type ProgressStyles = CSSProperties & {
  "--progress": number;
};

export const ProgressTrack = ({
  value,
  label = "Прогресс",
  color = "blue",
}: ProgressTrackProps) => {
  const normalizedValue = Math.min(100, Math.max(0, value));

  const progressStyles: ProgressStyles = {
    "--progress": normalizedValue / 100,
  };

  return (
    <div
      className={clsx(styles.track, styles[color])}
      style={progressStyles}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalizedValue}
    >
      <div className={styles.fill} />
    </div>
  );
};
