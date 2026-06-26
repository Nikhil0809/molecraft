import styles from "./ValidationLabel.module.css";

interface ValidationLabelProps {
  method: string;
}

const METHOD_LABELS: Record<string, { label: string; tooltip: string }> = {
  "scaffold-split": {
    label: "Scaffold-validated",
    tooltip:
      "Validated using scaffold splitting — structurally distinct molecules in train/test sets. More rigorous than random splitting.",
  },
  "random-split": {
    label: "Random-split",
    tooltip:
      "Validated using random splitting. May overestimate performance on novel scaffolds.",
  },
};

export function ValidationLabel({ method }: ValidationLabelProps) {
  const info = METHOD_LABELS[method] || { label: method, tooltip: method };

  return (
    <span className={styles.label} title={info.tooltip}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
      </svg>
      {info.label}
    </span>
  );
}
