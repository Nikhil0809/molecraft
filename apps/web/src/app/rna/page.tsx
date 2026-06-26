"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function RNAPage() {
  const [mode, setMode] = useState<"sirna" | "aso" | "mrna">("sirna");
  const [targetGene, setTargetGene] = useState("EGFR");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const design = async () => {
    setLoading(true);
    try {
      const body: any = { action: mode };
      if (mode === "sirna") body.target_gene = targetGene;
      if (mode === "aso") body.target_rna = targetGene;
      if (mode === "mrna") body.protein_sequence = targetGene;
      const res = await fetch("/api/rna", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setResult(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>RNA Therapeutics Design</h1>
        <p className={styles.subtitle}>Design siRNA, ASO gapmers, and optimize mRNA sequences</p>
      </header>
      <div className={styles.controls}>
        <div className={styles.tabs}>
          {(["sirna", "aso", "mrna"] as const).map(m => (
            <button key={m} className={`${styles.tab} ${mode === m ? styles.active : ""}`} onClick={() => { setMode(m); setResult(null); }}>
              {m === "sirna" ? "siRNA" : m === "aso" ? "ASO Gapmer" : "mRNA Optimization"}
            </button>
          ))}
        </div>
        <input className={styles.input} value={targetGene} onChange={e => setTargetGene(e.target.value)}
          placeholder={mode === "sirna" ? "Target gene (e.g. EGFR, TNF, KRAS)" : mode === "aso" ? "Target RNA sequence" : "Protein sequence"} />
        <button className={styles.button} onClick={design} disabled={loading}>{loading ? "Designing..." : "Design"}</button>
      </div>
      {result && (
        <div className={styles.results}>
          {mode === "sirna" && result.designs && (
            <div className={styles.section}>
              <div className={styles.targetInfo}>Target: {result.target_gene}</div>
              <div className={styles.grid}>
                {result.designs.map((s: any, i: number) => (
                  <div key={i} className={styles.card}>
                    <div className={styles.cardHeader}>siRNA {i + 1}</div>
                    <div className={styles.efficacy}>Efficacy: {(s.efficacy_score * 100).toFixed(0)}%</div>
                    <div className={styles.strand}>Sense: <code>{s.sense_strand}</code></div>
                    <div className={styles.strand}>Anti:  <code>{s.antisense_strand}</code></div>
                    <div className={styles.meta}>GC: {(s.gc_content * 100).toFixed(0)}% | Tm: {s.melting_temp_c}°C | Off-target: {(s.off_target_score * 100).toFixed(0)}%</div>
                    <div className={styles.mod}>{s.modification_pattern}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mode === "aso" && result.designs && (
            <div className={styles.section}>
              <div className={styles.grid}>
                {result.designs.map((a: any, i: number) => (
                  <div key={i} className={styles.card}>
                    <div className={styles.cardHeader}>ASO {i + 1}</div>
                    <div className={styles.strand}>Sequence: <code>{a.sequence}</code></div>
                    <div className={styles.meta}>GC: {(a.gc_content * 100).toFixed(0)}% | Tm: {a.melting_temp_c}°C</div>
                    <div className={styles.meta}>RNase H: {a.rnase_h_activity} | Duplex: {a.duplex_stability}</div>
                    {a.gapmer_config?.gap && <div className={styles.gapmer}>Gap: {a.gapmer_config.gap_length}nt | {a.gapmer_config.modifications}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {mode === "mrna" && result.sequences && (
            <div className={styles.section}>
              <div className={styles.mrnaStats}>CAI: {result.codon_adaptation_index} | GC: {(result.gc_content * 100).toFixed(0)}% | Expression: {(result.predicted_expression * 100).toFixed(0)}% | Stability: {(result.stability_score * 100).toFixed(0)}%</div>
              {result.sequences.map((s: any, i: number) => (
                <div key={i} className={styles.mrnaSeq}>
                  <div className={styles.seqLabel}>mRNA {i + 1} ({s.length}nt)</div>
                  <code>{s.sequence?.slice(0, 80)}...</code>
                  <div className={styles.seqMeta}>5'UTR: {s.utr5} | 3'UTR: {s.utr3} | PolyA: {s.polyA_tail?.length}A</div>
                </div>
              ))}
            </div>
          )}
          <div className={styles.footer}>Inference: {result.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
