"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AmbientSuggestions.module.css";

interface Suggestion {
  id: string;
  label: string;
  description: string;
  icon?: string;
  action: () => void;
}

interface AmbientSuggestionsProps {
  targetText: string;
  onSelect: (suggestion: Suggestion) => void;
  position: { x: number; y: number };
  visible: boolean;
}

const SUGGESTIONS: Record<string, Suggestion[]> = {
  target: [
    {
      id: "inhibitors",
      label: "Find known inhibitors",
      description: "Search databases for known inhibitors of this target",
      action: () => {},
    },
    {
      id: "generate",
      label: "Generate novel candidates",
      description: "AI-powered generation of novel candidate molecules",
      action: () => {},
    },
    {
      id: "predict",
      label: "Predict resistances",
      description: "Analyze potential resistance mutations",
      action: () => {},
    },
  ],
  molecule: [
    {
      id: "admet",
      label: "View ADMET profile",
      description: "Absorption, distribution, metabolism, excretion, toxicity",
      action: () => {},
    },
    {
      id: "docking",
      label: "Run docking simulation",
      description: "Molecular docking against target proteins",
      action: () => {},
    },
    {
      id: "similar",
      label: "Find similar molecules",
      description: "Search for structurally similar compounds",
      action: () => {},
    },
  ],
  query: [
    {
      id: "filter",
      label: "Apply as live filter",
      description: "Filter all visible molecules by this criterion",
      action: () => {},
    },
    {
      id: "search",
      label: "Deep search",
      description: "Full RAG-powered search across all sources",
      action: () => {},
    },
  ],
};

export function AmbientSuggestions({ targetText, onSelect, position, visible }: AmbientSuggestionsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const lower = targetText.toLowerCase();
    if (lower.includes("casp") || lower.includes("egfr") || lower.includes("target") || lower.includes("protein")) {
      return SUGGESTIONS.target;
    } else if (lower.includes("smiles") || lower.includes("c") || lower.includes("n") || lower.includes("o")) {
      return SUGGESTIONS.molecule;
    } else if (targetText.length > 0) {
      return SUGGESTIONS.query;
    }
    return [];
  }, [targetText]);

  useEffect(() => {
    if (visible && ref.current) {
      ref.current.focus();
    }
  }, [visible]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && suggestions[activeIndex]) {
        e.preventDefault();
        onSelect(suggestions[activeIndex]);
      }
    },
    [suggestions, activeIndex, onSelect]
  );

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      ref={ref}
      className={styles.container}
      style={{
        left: Math.min(position.x, window.innerWidth - 280),
        top: Math.min(position.y + 10, window.innerHeight - suggestions.length * 44 - 20),
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className={styles.header}>Ambient actions</div>
      {suggestions.map((s, i) => (
        <button
          key={s.id}
          className={`${styles.suggestion} ${i === activeIndex ? styles.active : ""}`}
          onClick={() => onSelect(s)}
          onMouseEnter={() => setActiveIndex(i)}
        >
          <span className={styles.label}>{s.label}</span>
          <span className={styles.desc}>{s.description}</span>
        </button>
      ))}
    </div>
  );
}
