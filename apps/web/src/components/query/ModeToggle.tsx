"use client";

import styles from "./ModeToggle.module.css";

interface ModeToggleProps {
  mode: "generate" | "predict";
  onChange: (mode: "generate" | "predict") => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className={styles.toggle} role="radiogroup" aria-label="Operation mode">
      <button
        className={`${styles.option} ${mode === "generate" ? styles.active : ""}`}
        onClick={() => onChange("generate")}
        role="radio"
        aria-checked={mode === "generate"}
      >
        Generate
      </button>
      <button
        className={`${styles.option} ${mode === "predict" ? styles.active : ""}`}
        onClick={() => onChange("predict")}
        role="radio"
        aria-checked={mode === "predict"}
      >
        Predict
      </button>
      <div
        className={styles.slider}
        style={{ transform: mode === "predict" ? "translateX(100%)" : "translateX(0)" }}
      />
    </div>
  );
}
