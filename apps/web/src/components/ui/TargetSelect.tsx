"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TargetSearch.module.css";
import { TARGET_LIBRARY, type TargetEntry } from "@/lib/targets";

interface TargetSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  valueMode?: "name" | "code";
}

export function TargetSelect({ label, value, onChange, placeholder, disabled, name, valueMode = "name" }: TargetSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TARGET_LIBRARY.slice(0, 12);
    return TARGET_LIBRARY.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.gene.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [query]);

  const selectedEntry = useMemo(
    () => TARGET_LIBRARY.find((t) => t.name === value || t.code === value) || null,
    [value]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const handlePick = (entry: TargetEntry) => {
    onChange(valueMode === "code" ? entry.code : entry.name);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matched.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && matched[highlight]) {
        handlePick(matched[highlight]);
      } else {
        const trimmed = query.trim();
        if (trimmed) {
          onChange(trimmed);
          setOpen(false);
          setQuery("");
        }
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        <svg className={styles.icon} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          name={name}
          type="text"
          value={open ? query : selectedEntry ? selectedEntry.name : value}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
          placeholder={placeholder || "Search target protein..."}
          disabled={disabled}
          autoComplete="off"
          aria-label={label}
        />
      </div>

      {open && (
        <ul className={styles.dropdown}>
          {matched.length === 0 && (
            <li className={styles.empty}>
              {query.trim() ? `No library match for "${query}". Press Enter to use it.` : "No targets available."}
            </li>
          )}
          {matched.map((entry, idx) => (
            <li
              key={entry.id}
              className={`${styles.option} ${idx === highlight ? styles.highlight : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handlePick(entry);
              }}
              onMouseEnter={() => setHighlight(idx)}
            >
              <div className={styles.optionMain}>
                <span className={styles.optionName}>{entry.name}</span>
                <span className={styles.optionGene}>{entry.gene}</span>
              </div>
              <span className={styles.optionCat}>{entry.category}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}