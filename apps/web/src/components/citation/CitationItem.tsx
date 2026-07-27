import styles from "./CitationItem.module.css";
import type { Citation } from "./CitationPanel";

interface CitationItemProps {
  citation: Citation;
}

const SOURCE_STYLES: Record<string, { color: string }> = {
  "ChEMBL": { color: "#818cf8" },
  "PubMed": { color: "#f59e0b" },
  "PubChem": { color: "#10b981" },
  "UniProt": { color: "#38bdf8" },
  "Tavily": { color: "#a78bfa" },
};

function getDomain(url?: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) return "";
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isValidUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function CitationItem({ citation }: CitationItemProps) {
  const sourceColor = SOURCE_STYLES[citation.source]?.color || "#818cf8";
  const domain = citation.domain || getDomain(citation.url);
  const validUrl = isValidUrl(citation.url);

  return (
    <div className={styles.item}>
      <div className={styles.topRow}>
        <span className={styles.source} style={{ color: sourceColor }}>
          {citation.source.toUpperCase()}
        </span>
        {citation.year && (
          <span className={styles.year}>{citation.year}</span>
        )}
      </div>
      <p className={styles.title}>{citation.title}</p>
      <div className={styles.bottomRow}>
        {domain && (
          <span className={styles.domain}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2C3.5 2 2 4 2 6C2 8 3.5 10 6 10C8.5 10 10 8 10 6C10 4 8.5 2 6 2Z" stroke="currentColor" strokeWidth="1" />
              <path d="M2 6H10" stroke="currentColor" strokeWidth="1" />
              <path d="M6 2C7.5 2 9 4 9 6C9 8 7.5 10 6 10C4.5 10 3 8 3 6C3 4 4.5 2 6 2Z" stroke="currentColor" strokeWidth="1" />
            </svg>
            {domain}
          </span>
        )}
        {validUrl && (
          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.viewSource}
          >
            View Source
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
