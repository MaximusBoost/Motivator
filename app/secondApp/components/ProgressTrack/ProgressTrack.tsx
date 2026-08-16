import type { CSSProperties } from "react";
import styles from "./progressTrack.module.scss";

type ProgressTrackProps = {
  value: number;
  label?: string;
};

type ProgressStyles = CSSProperties & {
  "--progress": number;
};

export const ProgressTrack = ({
  value,
  label = "Прогресс",
}: ProgressTrackProps) => {
  const normalizedValue = Math.min(100, Math.max(0, value));

  const progressStyles: ProgressStyles = {
    "--progress": normalizedValue / 100,
  };

  return (
    <div
      className={styles.track}
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
