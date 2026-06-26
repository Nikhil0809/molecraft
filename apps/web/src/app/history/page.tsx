"use client";

import { useState, useEffect } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { RotatingLogo } from "@/components/loading/RotatingLogo";
import styles from "./page.module.css";

type FilterMode = "all" | "generate" | "predict";

export default function HistoryPage() {
  const [history, setHistory] = useState<Array<{ id: string; mode: string; query: string; moleculeCount: number; topAffinity: number; timestamp: string }>>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/history");
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filtered =
    filter === "all"
      ? history
      : history.filter((h) => h.mode === filter);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHrs < 1) return "Just now";
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>History</h1>
        <div className={styles.filters}>
          {(["all", "generate", "predict"] as FilterMode[]).map((f) => (
            <button
              key={f}
              className={`${styles.filterButton} ${filter === f ? styles.activeFilter : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "generate" ? "Generate" : "Predict"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px", gap: "16px" }}>
          <RotatingLogo size={48} baseDuration={12} clockwise />
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Loading history...</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="8" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16 16H32M16 24H32M16 32H24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          }
          title="No history yet"
          description="Your past generations and predictions will appear here."
        />
      ) : (
        <div className={styles.list}>
          {filtered.map((item, i) => (
            <div
              key={item.id}
              className={styles.historyItem}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={styles.itemIcon}>
                {item.mode === "generate" ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5L10 5.5L14 8L10 10.5L8 14.5L6 10.5L2 8L6 5.5L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                )}
              </div>
              <div className={styles.itemContent}>
                <div className={styles.itemQuery}>
                  {item.mode === "predict" ? (
                    <code className={styles.smilesText}>{item.query}</code>
                  ) : (
                    <span>{item.query}</span>
                  )}
                </div>
                <div className={styles.itemMeta}>
                  <span className={`${styles.modeBadge} ${styles[item.mode]}`}>
                    {item.mode === "generate" ? "Generate" : "Predict"}
                  </span>
                  <span className={styles.metaDot}>·</span>
                  <span>{item.moleculeCount} molecule{item.moleculeCount !== 1 ? "s" : ""}</span>
                  <span className={styles.metaDot}>·</span>
                  <span>Best: {item.topAffinity} nM</span>
                </div>
              </div>
              <div className={styles.itemTime}>{formatDate(item.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
