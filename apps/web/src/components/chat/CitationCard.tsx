"use client";

import { useState } from "react";
import { SourcePill, type SourceStatus } from "@/components/retrieval/SourcePill";
import { CitationItem } from "@/components/citation/CitationItem";
import styles from "./CitationCard.module.css";

export interface ChatCitation {
  id: string;
  source: string;
  title: string;
  year?: number;
  url?: string;
  tier?: number;
}

export interface ChatSource {
  name: string;
  status: SourceStatus;
  tier?: number;
  resultCount?: number;
  message?: string;
}

interface CitationCardProps {
  sources: ChatSource[];
  citations: ChatCitation[];
  loading?: boolean;
}

export function CitationCard({ sources, citations, loading }: CitationCardProps) {
  const [open, setOpen] = useState(false);
  const hasSources = sources.length > 0;
  const showSources = hasSources && (open || loading);
  const visible = loading || hasSources || citations.length > 0;

  if (!visible) return null;

  return (
    <div className={styles.card}>
      {showSources && (
        <div className={styles.sources}>
          {sources.map((s) => (
            <SourcePill
              key={s.name}
              name={s.name}
              status={s.status}
              tier={s.tier as 1 | 2 | 3 | undefined}
              resultCount={s.resultCount}
              message={s.message}
            />
          ))}
        </div>
      )}

      {citations.length > 0 && (
        <>
          <button type="button" className={styles.toggle} onClick={() => setOpen(!open)}>
            <span>{open ? "Hide citations" : "Show citations"}</span>
            <span className={styles.count}>{citations.length}</span>
            <i className={`fa-solid ${open ? "fa-chevron-up" : "fa-chevron-down"}`}></i>
          </button>
          {open && (
            <div className={styles.list}>
              {citations.map((c) => (
                <CitationItem
                  key={c.id}
                  citation={{
                    id: c.id,
                    source: c.source,
                    title: c.title,
                    year: c.year,
                    url: c.url,
                    tier: (c.tier as 1 | 2 | 3 | undefined) ?? 1,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}