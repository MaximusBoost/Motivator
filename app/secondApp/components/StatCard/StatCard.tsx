import styles from "./statCard.module.scss";

type StatCardProps = {
  value: string | number;
  label: string;
};

export function StatCard({ value, label }: StatCardProps) {
  return (
    <article className={styles.card}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
