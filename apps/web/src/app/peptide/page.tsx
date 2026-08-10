"use client";
import { useState } from "react";
import styles from "./page.module.css";
import { TargetSelect } from "@/components/ui/TargetSelect";

export default function PeptidePage() {
  const [target, setTarget] = useState("GLP1R");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [cyclic, setCyclic] = useState(false);

  const design = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/peptide", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "linear", target, length: 12, cyclic, count: 10 }),
      });
      setResult(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Peptide & Macrocycle Design</h1>
        <p className={styles.subtitle}>Design linear peptides, cyclic peptides, and stapled macrocycles</p>
      </header>
      <div className={styles.controls}>
        <TargetSelect value={target} onChange={setTarget} valueMode="code" placeholder="Search target protein (GLP1R, SSTR2, CypA)..." />
        <label className={styles.checkbox}>
          <input type="checkbox" checked={cyclic} onChange={e => setCyclic(e.target.checked)} />
          Cyclic
        </label>
        <button className={styles.button} onClick={design} disabled={loading}>{loading ? "Designing..." : "Design Peptides"}</button>
      </div>
      {result && (
        <div className={styles.results}>
          <div className={styles.summary}>Target: {result.target} | Best Affinity: {result.best_affinity_nm} nM | Total: {result.peptides?.length} designs</div>
          <div className={styles.grid}>
            {result.peptides?.map((p: any, i: number) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardHeader}>Peptide {i + 1}{p.cyclic ? " (cyclic)" : ""}</div>
                <div className={styles.affinity}>{p.target_affinity_nm} nM</div>
                <div className={styles.sequence}>{p.sequence}</div>
                <div className={styles.meta}>MW: {p.mw_da} Da | Charge: {p.charge > 0 ? "+" : ""}{p.charge} | pI: {p.isoelectric_point}</div>
                <div className={styles.meta}>Solubility: {(p.solubility * 100).toFixed(0)}% | Membrane: {(p.membrane_permeability * 100).toFixed(0)}% | Stability: {(p.protease_stability * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
          <div className={styles.footer}>Inference: {result.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
