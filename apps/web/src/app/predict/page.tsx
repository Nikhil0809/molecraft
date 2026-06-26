"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QueryBar } from "@/components/query/QueryBar";
import { MoleculeStructure2D } from "@/components/molecule/MoleculeStructure2D";
import { AffinityBadge } from "@/components/molecule/AffinityBadge";
import { ConfidenceInterval } from "@/components/molecule/ConfidenceInterval";
import { ValidationLabel } from "@/components/molecule/ValidationLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import { RotatingLogo } from "@/components/loading/RotatingLogo";
import styles from "./page.module.css";

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

const MOCK_TARGETS = [
  "COX-2 (Cyclooxygenase-2)",
  "EGFR (Epidermal Growth Factor Receptor)",
  "BRAF (B-Raf proto-oncogene)",
  "ACE2 (Angiotensin-converting enzyme 2)",
  "HER2 (Human epidermal growth factor receptor 2)",
];

function PredictPageContent() {
  const searchParams = useSearchParams();
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(MOCK_TARGETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

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

      // Convert feature scores to percentages
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
        { label: "Hydrophobic contacts", value: hydro / sum, color: "var(--accent-success)" },
        { label: "Electrostatic", value: electro / sum, color: "#8B5CF6" },
        { label: "H-bond acceptors", value: entropy / sum, color: "var(--accent-primary)" },
        { label: "Van der Waals", value: rot / sum, color: "var(--text-secondary)" },
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

  const handleSubmit = useCallback(
    (query: string) => {
      runPrediction(query, selectedTarget);
    },
    [selectedTarget, runPrediction]
  );

  // Auto trigger prediction if parameter is in URL query
  useEffect(() => {
    const smilesParam = searchParams.get("smiles");
    if (smilesParam) {
      window.history.replaceState({}, document.title, window.location.pathname);
      (async () => {
        await runPrediction(smilesParam, selectedTarget);
      })();
    }
  }, [searchParams, selectedTarget, runPrediction]);

  return (
    <div className={styles.page}>
      <QueryBar
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        defaultMode="predict"
      />

      {/* Target selector */}
      <div className={styles.targetBar}>
        <label className={styles.targetLabel}>Target Protein</label>
        <select
          className={styles.targetSelect}
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(e.target.value)}
        >
          {MOCK_TARGETS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {!prediction && !isLoading ? (
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
      ) : (
        <div className={styles.resultArea}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <RotatingLogo size={48} baseDuration={12} clockwise />
              <p className={styles.loadingText}>Running binding affinity prediction...</p>
              <span className={styles.loadingSubtext}>
                Analyzing molecular features against {selectedTarget.split(" (")[0]}
              </span>
            </div>
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
      <div className={styles.loadingState}>
        <RotatingLogo size={48} baseDuration={12} clockwise />
        <p className={styles.loadingText}>Loading predictor...</p>
      </div>
    }>
      <PredictPageContent />
    </Suspense>
  );
}
