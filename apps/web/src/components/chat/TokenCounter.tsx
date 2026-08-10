"use client";

import { estimateTokens } from "@/lib/chat/smiles";
import styles from "./TokenCounter.module.css";

interface TokenCounterProps {
  messages: { role: string; content: string }[];
  input?: string;
  limit?: number;
}

export function TokenCounter({ messages, input = "", limit = 30000 }: TokenCounterProps) {
  const historyTokens = messages.reduce((acc, m) => acc + estimateTokens(m.content), 0);
  const inputTokens = estimateTokens(input);
  const total = historyTokens + inputTokens;

  const pct = Math.min(100, Math.round((total / limit) * 100));
  const over = total > limit;
  const level = over ? "over" : pct > 70 ? "high" : pct > 45 ? "mid" : "low";

  return (
    <div
      className={styles.wrap}
      title={`${total.toLocaleString()} tokens in context · ${limit.toLocaleString()} limit`}
    >
      <div className={styles.bar}>
        <div className={`${styles.fill} ${styles[level]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`${styles.count} ${over ? styles.over : ""}`}>
        {total.toLocaleString()}
        {over && <i className="fa-solid fa-triangle-exclamation"></i>}
      </span>
    </div>
  );
}