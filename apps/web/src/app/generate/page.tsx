"use client";

import { useState, useCallback } from "react";
import { QueryBar } from "@/components/query/QueryBar";
import { RetrievalStatusStrip } from "@/components/retrieval/RetrievalStatusStrip";
import type { SourceState } from "@/components/retrieval/RetrievalStatusStrip";
import { MoleculeCard } from "@/components/molecule/MoleculeCard";
import type { MoleculeData } from "@/components/molecule/MoleculeCard";
import { CitationPanel } from "@/components/citation/CitationPanel";
import type { Citation } from "@/components/citation/CitationPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnboardingOverlay } from "@/components/ui/OnboardingOverlay";
import { MoleculeDetailsPanel } from "@/components/molecule/MoleculeDetailsPanel";
import styles from "./page.module.css";

export default function GeneratePage() {
  const [sources, setSources] = useState<SourceState[]>([]);
  const [molecules, setMolecules] = useState<MoleculeData[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedMolecule, setSelectedMolecule] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleSave = useCallback((moleculeId: string, isSaved: boolean) => {
    setMolecules((prev) =>
      prev.map((m) => (m.id === moleculeId ? { ...m, isSaved } : m))
    );
  }, []);

  const handleSubmit = useCallback(async (query: string, mode: string) => {
    if (mode === "predict") {
      window.location.href = `/predict?smiles=${encodeURIComponent(query)}`;
      return;
    }

    setError(null);
    setIsLoading(true);
    setHasSearched(true);
    setMolecules([]);
    setCitations([]);

    // Set all sources to searching immediately
    setSources([
      { name: "ChEMBL", status: "searching", tier: 1, message: "Querying ChEMBL database for active assays..." },
      { name: "PubMed", status: "searching", tier: 1, message: "Searching PubMed index for literature..." },
      { name: "PubChem", status: "searching", tier: 1, message: "Extracting active structure matrices..." },
      { name: "UniProt", status: "searching", tier: 1, message: "Extracting receptor binding domains..." },
    ]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation pipeline failed.");
      }

      const data = await response.json();

      // Update source statuses from real RAG pipeline response
      if (data.sources) {
        setSources((data.sources as Array<{ name: string; status: string; resultCount?: number; message: string }>).map((s) => ({
          name: s.name,
          status: s.status as SourceState["status"],
          tier: s.name === "Tavily" ? 3 : 1,
          resultCount: s.resultCount,
          message: s.message,
        })));
      }

      // Stream molecules in one at a time
      (data.molecules as MoleculeData[]).forEach((mol, i) => {
        setTimeout(() => {
          setMolecules((prev) => {
            if (prev.some((m) => m.id === mol.id)) return prev;
            return [...prev, mol];
          });
        }, i * 300);
      });

      // Citations after molecules
      setTimeout(() => {
        setCitations(data.citations);
        setIsLoading(false);
      }, data.molecules.length * 300 + 100);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setSources([]);
      setIsLoading(false);
    }
  }, []);

  const selectedMoleculeData = molecules.find((mol) => mol.id === selectedMolecule) || null;

  return (
    <>
      <OnboardingOverlay />
      <div className={styles.page}>
        <QueryBar onSubmit={handleSubmit} isLoading={isLoading} error={error} defaultMode="generate" />

        <RetrievalStatusStrip sources={sources} visible={sources.length > 0} />

        {!hasSearched ? (
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
        ) : molecules.length === 0 && !isLoading ? (
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
                <path d="M18 24H30M24 18V30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
            title="No molecules found"
            description="Try adjusting your query or using a different target protein. Ensure the protein name or identifier is correct."
          />
        ) : (
          <div className={styles.results}>
            <div className={styles.moleculesColumn}>
              <div className={styles.resultsHeader}>
                <h2 className={styles.resultsTitle}>
                  Candidate Molecules
                  {molecules.length > 0 && (
                    <span className={styles.resultsCount}>{molecules.length}</span>
                  )}
                </h2>
              </div>
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
                  <>
                    <div className={styles.skeletonCard}>
                      <div className={`${styles.skeletonStructure} skeleton`} />
                      <div className={styles.skeletonInfo}>
                        <div className={`${styles.skeletonLine} ${styles.skeletonWide} skeleton`} />
                        <div className={`${styles.skeletonLine} ${styles.skeletonMedium} skeleton`} />
                        <div className={`${styles.skeletonLine} ${styles.skeletonNarrow} skeleton`} />
                      </div>
                    </div>
                    <div className={styles.skeletonCard}>
                      <div className={`${styles.skeletonStructure} skeleton`} />
                      <div className={styles.skeletonInfo}>
                        <div className={`${styles.skeletonLine} ${styles.skeletonWide} skeleton`} />
                        <div className={`${styles.skeletonLine} ${styles.skeletonMedium} skeleton`} />
                        <div className={`${styles.skeletonLine} ${styles.skeletonNarrow} skeleton`} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={styles.citationsColumn}>
              <CitationPanel citations={citations} />
            </div>
          </div>
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
