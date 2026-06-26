"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function PROTACPage() {
  const [targetSmiles, setTargetSmiles] = useState("CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F");
  const [targetName, setTargetName] = useState("BRD4");
  const [e3Ligase, setE3Ligase] = useState("CRBN");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const design = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/protac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_smiles: targetSmiles,
          target_name: targetName,
          e3_ligase: e3Ligase,
          linker_type: "PEG",
          linker_length: 4,
          count: 5,
        }),
      });
      setResult(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>PROTAC Design Engine</h1>
        <p className={styles.subtitle}>Design targeted protein degraders with ternary complex prediction</p>
      </header>
      <div className={styles.controls}>
        <input className={styles.input} value={targetSmiles} onChange={e => setTargetSmiles(e.target.value)} placeholder="Target warhead SMILES" />
        <input className={styles.inputSmall} value={targetName} onChange={e => setTargetName(e.target.value)} placeholder="Target name" />
        <select className={styles.select} value={e3Ligase} onChange={e => setE3Ligase(e.target.value)}>
          {["CRBN", "VHL", "MDM2", "IAP", "DCAF16"].map(e3 => <option key={e3} value={e3}>{e3}</option>)}
        </select>
        <button className={styles.button} onClick={design} disabled={loading}>{loading ? "Designing..." : "Design PROTACs"}</button>
      </div>
      {result && (
        <div className={styles.results}>
          <div className={styles.summary}>Target: {result.target} | E3: {result.e3_ligase} | Best Score: {result.best_ternary_score}</div>
          <div className={styles.grid}>
            {result.designs?.map((p: any, i: number) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardHeader}>PROTAC {i + 1}</div>
                <div className={styles.dc50}>DC₅₀: {p.predicted_dc50_nm} nM</div>
                <div className={styles.statRow}>
                  <span>MW: {p.mw} Da</span> <span>LogP: {p.logp}</span> <span>SA: {p.synthetic_accessibility}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Interface: {p.ternary_complex?.interface_score}</span>
                  <span>Proximity: {p.ternary_complex?.proximity_nm} nm</span>
                </div>
                <div className={styles.statRow}>
                  <span>Glue Score: {p.molecular_glue_score}</span>
                  <span>Rot. Bonds: {p.rotatable_bonds}</span>
                </div>
                <div className={styles.linker}>Linker: {p.linker?.type} ({p.linker?.length} units, {p.linker?.length_a} Å)</div>
              </div>
            ))}
          </div>
          <div className={styles.footer}>Inference: {result.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
