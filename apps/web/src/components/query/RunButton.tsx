"use client";

import styles from "./RunButton.module.css";

interface RunButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function RunButton({ onClick, isLoading = false, disabled = false }: RunButtonProps) {
  return (
    <button
      className={`${styles.button} ${isLoading ? styles.loading : ""}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={isLoading ? "Running query..." : "Run query"}
    >
      {isLoading ? (
        <span className={styles.purpleSpinner} />
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 2.5L13 8L4 13.5V2.5Z" fill="currentColor" />
        </svg>
      )}
      <span>{isLoading ? "Running..." : "Run"}</span>
    </button>
  );
}
