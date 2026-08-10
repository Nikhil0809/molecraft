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

  const copy = () => {
    navigator.clipboard?.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.actionBtn}
        onClick={copy}
        title={copied ? "Copied" : "Copy message"}
      >
        <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`}></i>
      </button>
      {!isUser && !busy && onRegenerate && (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onRegenerate}
          title="Regenerate response"
        >
          <i className="fa-solid fa-rotate-right"></i>
        </button>
      )}
      {isUser && onEdit && (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onEdit}
          title="Edit and re-ask"
        >
          <i className="fa-solid fa-pen"></i>
        </button>
      )}
    </div>
  );
}