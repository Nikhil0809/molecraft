"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./QueryBar.module.css";
import { ModeToggle } from "./ModeToggle";
import { RunButton } from "./RunButton";

interface QueryBarProps {
  onSubmit?: (query: string, mode: "generate" | "predict") => void;
  isLoading?: boolean;
  error?: string | null;
  defaultMode?: "generate" | "predict";
}

export function QueryBar({
  onSubmit,
  isLoading = false,
  error = null,
  defaultMode = "generate",
}: QueryBarProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"generate" | "predict">(defaultMode);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    onSubmit?.(trimmed, mode);
  }, [query, mode, isLoading, onSubmit]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      // Esc to clear
      if (e.key === "Escape") {
        setQuery("");
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmit]);

  const placeholder =
    mode === "generate"
      ? "Enter target protein or disease context (e.g. COX-2, EGFR)..."
      : "Paste SMILES string (e.g. CCO, CC(=O)Oc1ccccc1C(=O)O)...";

  // Live Query Parsing
  const getQueryType = () => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    // Basic heuristic: no spaces, matches SMILES characters, contains carbon/nitrogen/oxygen or ring structure
    const isSmilesPattern = /^[A-Za-z0-9@+\-\[\]\(\)\\\/=#%.:]+$/.test(trimmed);
    if (isSmilesPattern && (trimmed.includes("=") || trimmed.includes("(") || trimmed.includes(")") || trimmed.length > 5)) {
      return "SMILES";
    }
    return "TARGET";
  };

  const queryType = getQueryType();

  const handleTemplateClick = (q: string, m: "generate" | "predict") => {
    setQuery(q);
    setMode(m);
    inputRef.current?.focus();
  };

  const templates = [
    { label: "COX-2 Selective", query: "COX-2 selective pocket", mode: "generate" as const },
    { label: "EGFR Kinase Pocket", query: "EGFR binding domain", mode: "generate" as const },
    { label: "SMILES: Aspirin", query: "CC(=O)Oc1ccccc1C(=O)O", mode: "predict" as const },
    { label: "SMILES: Caffeine", query: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", mode: "predict" as const },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.queryBar} ${error ? styles.hasError : ""}`}>
        <div className={styles.inputArea}>
          <svg
            className={styles.searchIcon}
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            aria-label="Query input"
            disabled={isLoading}
          />
          {queryType && (
            <span className={`${styles.parserBadge} ${styles[queryType.toLowerCase()]}`}>
              {queryType}
            </span>
          )}
          {query && (
            <button
              className={styles.clearButton}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear query"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className={styles.actions}>
          <ModeToggle mode={mode} onChange={setMode} />
          <RunButton onClick={handleSubmit} isLoading={isLoading} disabled={!query.trim()} />
        </div>
      </div>
      {error && (
        <div className={styles.errorMessage} role="alert">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 4V8M7 9.5V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}
      <div className={styles.bottomBar}>
        <div className={styles.templates}>
          <span className={styles.templateLabel}>Quick Templates:</span>
          {templates.map((t) => (
            <button
              key={t.label}
              className={`${styles.templatePill} ${mode === t.mode && query === t.query ? styles.templateActive : ""}`}
              onClick={() => handleTemplateClick(t.query, t.mode)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.shortcutHint}>
          <kbd>⌘</kbd><kbd>↵</kbd> to run &nbsp;·&nbsp; <kbd>Esc</kbd> to clear
        </div>
      </div>
    </div>
  );
}
