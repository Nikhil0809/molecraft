"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function AntibodyPage() {
  const [target, setTarget] = useState("EGFR");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const design = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/antibody", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, affinity_target_nm: 0.1, species: "humanized", count: 5 }),
      });
      setResult(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Antibody Design Engine</h1>
        <p className={styles.subtitle}>De-novo design of humanized monoclonal antibodies with CDR engineering</p>
      </header>
      <div className={styles.controls}>
        <select className={styles.select} value={target} onChange={e => setTarget(e.target.value)}>
          {["EGFR", "PD1", "HER2", "CD20", "TNFa", "VEGFA", "CTLA4", "IL6R"].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button className={styles.button} onClick={design} disabled={loading}>
          {loading ? "Designing..." : "Design Antibodies"}
        </button>
      </div>
      {result && (
        <div className={styles.results}>
          <div className={styles.targetInfo}>
            Target: {result.target} | Epitope: {result.target_info?.epitope} | Class: {result.target_info?.class}
          </div>
          <div className={styles.grid}>
            {result.antibodies?.map((ab: any, i: number) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardHeader}>Candidate {i + 1}</div>
                <div className={styles.affinity}>{ab.predicted_affinity_nm} nM</div>
                <div className={styles.detail}>CDR-H3: <code>{ab.cdr_h3}</code></div>
                <div className={styles.detail}>Developability: {ab.developability_score}</div>
                <div className={styles.detail}>Stability: {ab.stability_score}</div>
                <div className={styles.detail}>Aggregation: <span className={styles[ab.aggregation_risk]}>{ab.aggregation_risk}</span></div>
                <div className={styles.detail}>Format: {ab.format}</div>
              </div>
            ))}
          </div>
          <div className={styles.footer}>Inference: {result.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
