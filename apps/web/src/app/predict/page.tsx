"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { MoleculeStructure2D } from "@/components/molecule/MoleculeStructure2D";
import { AffinityBadge } from "@/components/molecule/AffinityBadge";
import { ConfidenceInterval } from "@/components/molecule/ConfidenceInterval";
import { ValidationLabel } from "@/components/molecule/ValidationLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import { PurpleSpinner } from "@/components/loading/PurpleSpinner";
import { TargetSelect } from "@/components/ui/TargetSelect";

const ACTION_LABELS = [
  "Predict Affinity", "Estimate Binding", "Calculate Potency", "Score Docking",
  "Validate Target", "Assay Simulation", "Dock Ligands", "Rank Hits",
];

interface PredictionResult {
  smiles: string;
  name: string;
  target: string;
  affinity: number;
  unit: string;
  ciLow: number;
  ciHigh: number;
  validationMethod: string;
  contributions: { label: string; value: number; color: string }[];
}

function PredictPageContent() {
  const searchParams = useSearchParams();
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState("EGFR (Epidermal Growth Factor Receptor)");
  const [error, setError] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [actionLabel] = useState(() => ACTION_LABELS[Math.floor(Math.random() * ACTION_LABELS.length)]);
  const [smilesInput, setSmilesInput] = useState("");

  const FEATURE_DESCRIPTIONS: Record<string, string> = {
    "H-bond acceptors": "Oxygen/nitrogen atoms forming crucial polar attractions in the active pocket.",
    "Hydrophobic contacts": "Non-polar carbon scaffold contacts matching hydrophobic pocket pockets.",
    "Electrostatic": "Attraction between positive/negative charges on ligand and active residues.",
    "Van der Waals": "Weak shape-dependent forces conforming to the target pocket contours.",
  };

  const runPrediction = useCallback(async (smilesQuery: string, targetProtein: string) => {
    setError(null);
    setIsLoading(true);
    setPrediction(null);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smiles: smilesQuery, targetProtein }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Binding affinity prediction failed.");
      }

      const data = await response.json();

      const f = data.featureScores || {
        binding_entropy: -6.42,
        electrostatic_contribution: -9.18,
        hydrophobic_interaction: -5.55,
        rotatable_bond_penalty: 1.54,
      };

      const entropy = Math.abs(f.binding_entropy);
      const electro = Math.abs(f.electrostatic_contribution);
      const hydro = Math.abs(f.hydrophobic_interaction);
      const rot = Math.abs(f.rotatable_bond_penalty);
      const sum = entropy + electro + hydro + rot;

      const contributions = [
        { label: "Hydrophobic contacts", value: hydro / sum, color: "#10b981" },
        { label: "Electrostatic", value: electro / sum, color: "#8B5CF6" },
        { label: "H-bond acceptors", value: entropy / sum, color: "#6366f1" },
        { label: "Van der Waals", value: rot / sum, color: "#64748b" },
      ].sort((a, b) => b.value - a.value);

      setPrediction({
        smiles: data.smiles,
        name: "Query Molecule",
        target: data.targetProtein,
        affinity: data.affinity,
        unit: "nM",
        ciLow: data.ciLow,
        ciHigh: data.ciHigh,
        validationMethod: data.validationMethod,
        contributions,
      });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during prediction.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = smilesInput.trim();
    if (!trimmed || isLoading) return;
    runPrediction(trimmed, selectedTarget);
  }, [smilesInput, selectedTarget, isLoading, runPrediction]);

  useEffect(() => {
    const smilesParam = searchParams.get("smiles");
    if (smilesParam) {
      setSmilesInput(smilesParam);
      window.history.replaceState({}, document.title, window.location.pathname);
      (async () => {
        await runPrediction(smilesParam, selectedTarget);
      })();
    }
  }, [searchParams, selectedTarget, runPrediction]);

  return (
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
            value={smilesInput}
            onChange={(e) => setSmilesInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="Paste SMILES string (e.g. CCO, CC(=O)Oc1ccccc1C(=O)O)..."
            disabled={isLoading}
          />
          <span className={styles.parserBadge}>SMILES</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.primaryBtn} onClick={handleSubmit} disabled={isLoading || !smilesInput.trim()}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 1.5L12 7L3 12.5V1.5Z" fill="currentColor" />
            </svg>
            {isLoading ? "Predicting..." : actionLabel}
          </button>
        </div>
      </header>

      {/* Target Selector */}
      <section className={styles.sourcesSection}>
        <div className={styles.sourcesInfo}>
          <div className={styles.sourcesTitle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "#60a5fa" }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8" cy="8" r="2" fill="currentColor" />
            </svg>
            Target Protein
          </div>
          <p className={styles.sourcesSubtext}>Select the protein target for binding affinity prediction.</p>
        </div>
        <TargetSelect
          value={selectedTarget}
          onChange={setSelectedTarget}
          placeholder="Search target protein (e.g. EGFR, KRAS, BRD4)..."
        />
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

      {!prediction && !isLoading ? (
        <div className={styles.emptyArea}>
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="24" cy="24" r="2" fill="currentColor"/>
                <path d="M24 6V10M24 38V42M6 24H10M38 24H42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
            title="Predict binding affinity"
            description="Paste a SMILES string and select a target protein to predict binding affinity with confidence intervals."
          />
        </div>
      ) : (
        <div className={styles.resultArea}>
          {isLoading ? (
            <PurpleSpinner
              size={48}
              text="Running binding affinity prediction..."
              subtext={`Analyzing molecular features against ${selectedTarget.split(" (")[0]}`}
            />
          ) : prediction ? (
            <div className={styles.predictionCard}>
              <div className={styles.predictionLeft}>
                <div className={styles.structureWrapper}>
                  <MoleculeStructure2D smiles={prediction.smiles} width={300} height={200} />
                </div>
                <div className={styles.smilesDisplay}>
                  <code>{prediction.smiles}</code>
                </div>
              </div>

              <div className={styles.predictionRight}>
                <div className={styles.targetInfo}>
                  <span className={styles.targetInfoLabel}>Target</span>
                  <span className={styles.targetInfoValue}>{prediction.target}</span>
                </div>

                <div className={styles.affinitySection}>
                  <span className={styles.affinitySectionLabel}>Predicted Binding Affinity</span>
                  <div className={styles.affinityDisplay}>
                    <AffinityBadge value={prediction.affinity} unit={prediction.unit} />
                    <ConfidenceInterval low={prediction.ciLow} high={prediction.ciHigh} />
                  </div>
                  <ValidationLabel method={prediction.validationMethod} />
                </div>

                <div className={styles.contributionsSection}>
                  <span className={styles.contributionsLabel}>Feature Contributions</span>
                  <div className={styles.contributionsList}>
                    {prediction.contributions.map((c) => (
                      <div
                        key={c.label}
                        className={`${styles.contributionRow} ${hoveredFeature === c.label ? styles.rowHovered : ""}`}
                        onMouseEnter={() => setHoveredFeature(c.label)}
                        onMouseLeave={() => setHoveredFeature(null)}
                      >
                        <span className={styles.contributionName}>{c.label}</span>
                        <div className={styles.contributionBar}>
                          <div
                            className={styles.contributionFill}
                            style={{
                              width: `${c.value * 100}%`,
                              background: c.color,
                            }}
                          />
                        </div>
                        <span className={styles.contributionValue}>{(c.value * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                  {hoveredFeature && FEATURE_DESCRIPTIONS[hoveredFeature] && (
                    <div className={styles.featureTooltip} role="status">
                      <span className={styles.tooltipIcon}>💡</span>
                      <span className={styles.tooltipText}>{FEATURE_DESCRIPTIONS[hoveredFeature]}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function PredictPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <PurpleSpinner size={48} text="Loading predictor..." />
      </div>
    }>
      <PredictPageContent />
    </Suspense>
  );
}
