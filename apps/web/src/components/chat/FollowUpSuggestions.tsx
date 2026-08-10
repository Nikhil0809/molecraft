"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./FollowUpSuggestions.module.css";

const POOL = [
  "Delve deeper into the mechanism of action",
  "Compare this approach with clinical candidates",
  "Suggest analogs to improve selectivity",
  "Analyze patent or IP landscape risks",
  "Propose a validation experiment design",
  "Explain the key trade-offs in simpler terms",
  "Summarize this into a research shortlist",
  "Map next steps as a structured workflow",
];

interface FollowUpSuggestionsProps {
  seed: number;
  onPick: (text: string) => void;
}

export function FollowUpSuggestions({ seed, onPick }: FollowUpSuggestionsProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(t);
  }, []);

  const picks = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < POOL.length && out.length < 3; i++) {
      const item = POOL[(seed * 3 + i * 2) % POOL.length];
      if (!out.includes(item)) out.push(item);
    }
    return out;
  }, [seed]);

  if (!visible) return null;

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Recommended next steps</span>
      <div className={styles.rows}>
        {picks.map((p) => (
          <button
            key={p}
            type="button"
            className={styles.pick}
            onClick={() => onPick(p)}
            title={`Ask: ${p}`}
          >
            <i className="fa-solid fa-arrow-right"></i>
            <span>{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}