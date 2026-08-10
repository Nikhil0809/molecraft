"use client";

import { useState, useCallback } from "react";
import styles from "./page.module.css";
import { MoleculeCard } from "@/components/molecule/MoleculeCard";
import type { MoleculeData } from "@/components/molecule/MoleculeCard";
import { CitationPanel } from "@/components/citation/CitationPanel";
import type { Citation } from "@/components/citation/CitationPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnboardingOverlay } from "@/components/ui/OnboardingOverlay";
import { MoleculeDetailsPanel } from "@/components/molecule/MoleculeDetailsPanel";
import { PurpleSpinner } from "@/components/loading/PurpleSpinner";

const ACTION_LABELS = [
  "Scan Targets", "Probe Binding", "Map Interactions", "Dock Molecules",
  "Screen Library", "Predict Activity", "Mine Patents", "Review Literature",
];

const SOURCE_BADGES = [
  { name: "ChEMBL", active: true, count: 1 },
  { name: "PubMed", active: true, count: 5 },
  { name: "UniProt", active: true, count: 1 },
  { name: "WebSearch", active: true, count: 5 },
  { name: "PatentDB", active: false },
  { name: "ClinicalTrials", active: false },
];

export default function GeneratePage() {
  const [query, setQuery] = useState("COX-2 selective pocket");
  const [molecules, setMolecules] = useState<MoleculeData[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedMolecule, setSelectedMolecule] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLabel] = useState(() => ACTION_LABELS[Math.floor(Math.random() * ACTION_LABELS.length)]);

  const handleToggleSave = useCallback((moleculeId: string, isSaved: boolean) => {
    setMolecules((prev) =>
      prev.map((m) => (m.id === moleculeId ? { ...m, isSaved } : m))
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setIsLoading(true);
    setHasSearched(true);
    setMolecules([]);
    setCitations([]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation pipeline failed.");
      }

      const data = await response.json();

      (data.molecules as MoleculeData[]).forEach((mol, i) => {
        setTimeout(() => {
          setMolecules((prev) => {
            if (prev.some((m) => m.id === mol.id)) return prev;
            return [...prev, mol];
          });
        }, i * 300);
      });

      setTimeout(() => {
        setCitations(data.citations);
        setIsLoading(false);
      }, data.molecules.length * 300 + 100);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setIsLoading(false);
    }
  }, [query, isLoading]);

  const selectedMoleculeData = molecules.find((mol) => mol.id === selectedMolecule) || null;

  return (
    <>
      <OnboardingOverlay />
      <div className={styles.page}>

        {/* Header / Search Bar */}
        <header className={styles.header}>
          <div className={styles.searchBar}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="Enter target protein or disease context..."
              disabled={isLoading}
            />
            <span className={styles.parserBadge}>TARGET</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.primaryBtn} onClick={handleSubmit} disabled={isLoading || !query.trim()}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 1.5L12 7L3 12.5V1.5Z" fill="currentColor" />
              </svg>
              {isLoading ? "Running..." : actionLabel}
            </button>
          </div>
        </header>

        {/* Verified Data Sources */}
        <section className={styles.sourcesSection}>
          <div className={styles.sourcesInfo}>
            <div className={styles.sourcesTitle}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "#60a5fa" }}>
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verified Data Sources
            </div>
            <p className={styles.sourcesSubtext}>Cross-referenced indexing across global genomic registries and clinical repositories.</p>
          </div>
          <div className={styles.sourceBadges}>
            {SOURCE_BADGES.map((s) => (
              <div key={s.name} className={`${styles.sourceBadge} ${s.active ? styles.sourceActive : styles.sourceInactive}`}>
                <span className={`${styles.sourceDot} ${s.active ? styles.dotActive : styles.dotInactive}`} />
                <span className={s.active ? styles.sourceName : ""}>{s.name}</span>
                {s.active && s.count !== undefined && (
                  <span className={styles.sourceCount}>{s.count}</span>
                )}
                {!s.active && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div className={styles.errorBanner}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4V8M7 9.5V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* Results */}
        {!hasSearched ? (
          <div className={styles.emptyArea}>
            <EmptyState
              icon={
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 6L30 18L42 24L30 30L24 42L18 30L6 24L18 18L24 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              }
              title="Generate candidate molecules"
              description="Enter a target protein, disease context, or molecular target. MoleCraft will search scientific databases and generate candidate molecules with binding affinity predictions."
            />
          </div>
        ) : (
          <main className={styles.mainContent}>
            <div className={styles.moleculesColumn}>
              <div className={styles.resultsHeader}>
                <h2 className={styles.resultsTitle}>
                  Candidate Formulations
                  {molecules.length > 0 && (
                    <span className={styles.resultsCount}>{molecules.length} Items</span>
                  )}
                </h2>
                <div className={styles.templateTags}>
                  <span className={styles.templateLabel}>Quick Templates:</span>
                  <button className={styles.templateTag}>COX-2 Selective</button>
                  <span className={styles.templateSep}>•</span>
                  <button className={styles.templateTag}>Aspirin Matrix</button>
                </div>
              </div>

              {isLoading && molecules.length === 0 ? (
                <PurpleSpinner
                  size={48}
                  text="Running generation pipeline..."
                  subtext="Searching databases and generating candidate molecules"
                />
              ) : (
                <div className={styles.moleculesGrid}>
                  {molecules.map((mol, i) => (
                    <MoleculeCard
                      key={mol.id}
                      molecule={mol}
                      isSelected={selectedMolecule === mol.id}
                      onSelect={setSelectedMolecule}
                      index={i}
                      onToggleSave={handleToggleSave}
                    />
                  ))}
                  {isLoading && (
                    <div className={styles.loadingOverlay}>
                      <PurpleSpinner size={36} text="Generating more candidates..." />
                    </div>
                  )}
                </div>
              )}

              {!isLoading && molecules.length === 0 && hasSearched && (
                <EmptyState
                  icon={
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
                      <path d="M18 24H30M24 18V30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  }
                  title="No molecules found"
                  description="Try adjusting your query or using a different target protein."
                />
              )}
            </div>

            <div className={styles.citationsColumn}>
              <CitationPanel citations={citations} />
            </div>
          </main>
        )}
      </div>

      <MoleculeDetailsPanel
        molecule={selectedMoleculeData}
        onClose={() => setSelectedMolecule(null)}
        onToggleSave={handleToggleSave}
      />
    </>
  );
}
