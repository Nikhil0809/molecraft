import styles from "./ConfidenceInterval.module.css";

interface ConfidenceIntervalProps {
  low: number;
  high: number;
}

export function ConfidenceInterval({ low, high }: ConfidenceIntervalProps) {
  return (
    <span className={styles.ci} title="95% confidence interval">
      [{low} – {high}]
    </span>
  );
}
