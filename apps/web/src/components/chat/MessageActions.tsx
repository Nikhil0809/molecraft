"use client";

import { useState } from "react";
import styles from "./MessageActions.module.css";

interface MessageActionsProps {
  isUser: boolean;
  content: string;
  onRegenerate?: () => void;
  onEdit?: () => void;
  busy?: boolean;
}

export function MessageActions({ isUser, content, onRegenerate, onEdit, busy }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`${styles.actionBtn} ${copied ? styles.copied : ""}`}
        onClick={copy}
        aria-label={copied ? "Copied to clipboard" : "Copy message"}
      >
        <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`}></i>
        <span className={styles.tooltip}>{copied ? "Copied!" : "Copy"}</span>
      </button>
      {!isUser && !busy && onRegenerate && (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onRegenerate}
          aria-label="Regenerate response"
        >
          <i className="fa-solid fa-rotate-right"></i>
          <span className={styles.tooltip}>Regenerate</span>
        </button>
      )}
      {isUser && onEdit && (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onEdit}
          aria-label="Edit and re-ask"
        >
          <i className="fa-solid fa-pen"></i>
          <span className={styles.tooltip}>Edit</span>
        </button>
      )}
    </div>
  );
}