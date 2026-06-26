"use client";

import { useState } from "react";
import styles from "./MoleculeActions.module.css";

interface MoleculeActionsProps {
  smiles: string;
  moleculeId: string;
  isSaved?: boolean;
  onToggleSave?: (isSaved: boolean) => void;
}

export function MoleculeActions({ smiles, moleculeId, isSaved = false, onToggleSave }: MoleculeActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(smiles);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = smiles;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newSaved = !isSaved;
    onToggleSave?.(newSaved);
    try {
      await fetch("/api/molecules/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moleculeId, isSaved: newSaved }),
      });
    } catch (err) {
      onToggleSave?.(!newSaved);
      console.error("Save molecule error:", err);
    }
  };

  return (
    <div className={styles.actions}>
      <button
        className={styles.action}
        onClick={handleSave}
        title={isSaved ? "Unsave molecule" : "Save molecule"}
        aria-label={isSaved ? "Unsave molecule" : "Save molecule"}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          {isSaved ? (
            <path d="M2 2V12.5L7 9.5L12 12.5V2C12 1.44772 11.5523 1 11 1H3C2.44772 1 2 1.44772 2 2Z" fill="var(--accent-primary)" stroke="var(--accent-primary)" strokeWidth="1.2" />
          ) : (
            <path d="M2 2V12.5L7 9.5L12 12.5V2C12 1.44772 11.5523 1 11 1H3C2.44772 1 2 1.44772 2 2Z" stroke="currentColor" strokeWidth="1.2" />
          )}
        </svg>
      </button>

      <button
        className={`${styles.action} ${copied ? styles.copied : ""}`}
        onClick={handleCopy}
        title="Copy SMILES"
        aria-label="Copy SMILES"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7.5L5.5 10L11 4" stroke="var(--accent-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10 4V3C10 2.44772 9.55228 2 9 2H3C2.44772 2 2 2.44772 2 3V9C2 9.55228 2.44772 10 3 10H4" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        )}
      </button>
    </div>
  );
}
