"use client";

import { useCallback, useRef, useState } from "react";
import { AmbientSuggestions } from "./AmbientSuggestions";
import styles from "./SmartQuery.module.css";

interface SmartQueryProps {
  onQuery: (query: string) => void;
  placeholder?: string;
}

export function SmartQuery({ onQuery, placeholder = "Type a target, SMILES, or intent..." }: SmartQueryProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    setShowSuggestions(val.length > 0);

    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCursorPos({ x: rect.left, y: rect.bottom });
    }
  }, []);

  const handleSuggestionSelect = useCallback(
    (suggestion: { id: string; label: string; description: string; icon?: string; action: () => void }) => {
      suggestion.action();
      setShowSuggestions(false);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (input.trim()) {
          onQuery(input.trim());
          setInput("");
          setShowSuggestions(false);
        }
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        inputRef.current?.blur();
      }
    },
    [input, onQuery]
  );

  return (
    <div className={`${styles.container} ${isFocused ? styles.focused : ""}`}>
      <div className={styles.field}>
        <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 2L8 6L12 8L8 10L6 14L4 10L0 8L4 6L6 2Z" fill="var(--accent-primary)" fillOpacity="0.3" stroke="var(--accent-primary)" strokeWidth="1" strokeLinejoin="round"/>
          <circle cx="6" cy="8" r="1.5" fill="var(--accent-primary)"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
        {input && (
          <button className={styles.clear} onClick={() => { setInput(""); setShowSuggestions(false); inputRef.current?.focus(); }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
      <div className={styles.hints}>
        <span className={styles.hint}>Enter to submit</span>
        <span className={styles.sep}>·</span>
        <span className={styles.hint}>Esc to dismiss</span>
      </div>

      <AmbientSuggestions
        targetText={input}
        onSelect={handleSuggestionSelect}
        position={cursorPos}
        visible={showSuggestions}
      />
    </div>
  );
}
