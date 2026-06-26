"use client";
import { useState } from "react";
import styles from "./page.module.css";

interface TargetGene {
  gene_symbol: string; uniprot_id: string; confidence: number;
  druggability_score: number; novelty_score: number; evidence_level: string;
  pathways: string[]; description: string;
}

export default function OmicsPage() {
  const [disease, setDisease] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ targets: TargetGene[]; summary: any; inference_ms: number } | null>(null);

  const search = async () => {
    if (!disease.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/omics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disease: disease.trim(),
          omics_types: ["genomics", "transcriptomics", "proteomics"],
          min_confidence: 0.3,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Multi-Omics Target Discovery</h1>
        <p className={styles.subtitle}>Discover novel drug targets by integrating genomics, transcriptomics & proteomics data</p>
      </header>
      <div className={styles.searchBar}>
        <input className={styles.input} value={disease} onChange={e => setDisease(e.target.value)}
          placeholder="Enter disease name (e.g., Alzheimer, Parkinson, Lung Cancer, Heart Failure, Diabetes)" />
        <button className={styles.button} onClick={search} disabled={loading}>
          {loading ? "Analyzing..." : "Discover Targets"}
        </button>
      </div>
      {result && (
        <div className={styles.results}>
          <div className={styles.summary}>
            {result.summary && (
              <div className={styles.summaryGrid}>
                <div className={styles.stat}><strong>{result.summary.total_targets}</strong><span>Targets Found</span></div>
                <div className={styles.stat}><strong>{result.summary.high_confidence_targets}</strong><span>High Confidence</span></div>
                <div className={styles.stat}><strong>{result.summary.druggable_targets}</strong><span>Druggable</span></div>
                <div className={styles.stat}><strong>{result.summary.novel_targets}</strong><span>Novel Targets</span></div>
              </div>
            )}
            {result.summary?.recommended_target && (
              <div className={styles.recommendation}>
                Recommended Target: <strong>{result.summary.recommended_target}</strong>
              </div>
            )}
          </div>
          <div className={styles.targets}>
            {result.targets.map((t, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.gene}>{t.gene_symbol}</span>
                  <span className={`${styles.evidence} ${styles[t.evidence_level]}`}>{t.evidence_level}</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.metricRow}>
                    <span>Confidence: {(t.confidence * 100).toFixed(0)}%</span>
                    <span>Druggability: {(t.druggability_score * 100).toFixed(0)}%</span>
                    <span>Novelty: {(t.novelty_score * 100).toFixed(0)}%</span>
                  </div>
                  <div className={styles.uniprot}>UniProt: {t.uniprot_id}</div>
                  <div className={styles.pathways}>{t.pathways.slice(0, 3).join(" • ")}</div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.footer}>Inference: {result.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
