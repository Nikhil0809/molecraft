import styles from "./AffinityBadge.module.css";

interface AffinityBadgeProps {
  value: number;
  unit: string;
}

export function AffinityBadge({ value, unit }: AffinityBadgeProps) {
  return (
    <div className={styles.badge}>
      <span className={styles.value}>{value}</span>
      <span className={styles.unit}>{unit}</span>
    </div>
  );
}
