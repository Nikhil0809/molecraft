"use client";

import { useEffect, useState } from "react";
import styles from "./ThinkingDots.module.css";

const STAGES = [
  "Searching",
  "Gathering context",
  "Analyzing",
  "Reasoning",
  "Drafting",
];

export function ThinkingDots() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={styles.thinking}>
      <span className={styles.bars} aria-hidden="true">
        <span className={styles.bar}></span>
        <span className={styles.bar}></span>
        <span className={styles.bar}></span>
      </span>
      <span className={styles.stage} key={stage}>
        {STAGES[stage]}
        <span className={styles.dots} aria-hidden="true">
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </span>
    </div>
  );
}