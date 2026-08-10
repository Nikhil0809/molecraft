"use client";

import styles from "./DiffusionResultsPanel.module.css";
import { IPRiskBadge } from "./IPRiskBadge";
import { SynthesisRoute } from "./SynthesisRoute";
import type { DiffusionResult } from "./DiffusionDesigner";

interface DiffusionResultsPanelProps {
  results: DiffusionResult[];
  generatedCount?: number;
  filteredCount?: number;
  inferenceTimeMs?: number;
  onClose: () => void;
  onSelect: (result: DiffusionResult) => void;
}

export function DiffusionResultsPanel({
  results,
  generatedCount,
  filteredCount,
  inferenceTimeMs,
  onClose,
  onSelect,
}: DiffusionResultsPanelProps) {
  if (results.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Diffusion Results</h3>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>
        <div className={styles.empty}>
          <p>No molecules passed the filters.</p>
          <p className={styles.hint}>Try lowering SA threshold or disabling synthesis/IP filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Diffusion Results</h3>
          <p className={styles.meta}>
            {results.length} kept
            {generatedCount !== undefined && ` · ${generatedCount} sampled`}
            {filteredCount !== undefined && ` · ${filteredCount} after filters`}
            {inferenceTimeMs !== undefined && ` · ${inferenceTimeMs.toFixed(0)}ms`}
          </p>
        </div>
        <button className={styles.close} onClick={onClose}>×</button>
      </div>

      <div className={styles.list}>
        {results.map((mol) => {
          const ipDetails = mol.ipDetails as { max_similarity?: number };
          return (
            <button
              key={mol.id}
              className={styles.card}
              onClick={() => onSelect(mol)}
            >
              <div className={styles.cardHeader}>
                <span className={styles.name}>{mol.name}</span>
                <IPRiskBadge risk={mol.ipRisk} maxSimilarity={ipDetails?.max_similarity} />
              </div>

              <code className={styles.smiles}>{mol.smiles}</code>

              <div className={styles.metrics}>
                {mol.affinity > 0 && (
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Affinity</span>
                    <span className={styles.metricValue}>{mol.affinity.toFixed(1)} nM</span>
                  </div>
                )}
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>QED</span>
                  <span className={styles.metricValue}>{mol.qed.toFixed(2)}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>SA</span>
                  <span className={styles.metricValue}>{mol.saScore.toFixed(1)}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>MW</span>
                  <span className={styles.metricValue}>{mol.molWeight.toFixed(0)}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>LogP</span>
                  <span className={styles.metricValue}>{mol.logP.toFixed(1)}</span>
                </div>
              </div>

              <SynthesisRoute
                routes={mol.synthesisRoutes}
                saScore={mol.saScore}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}