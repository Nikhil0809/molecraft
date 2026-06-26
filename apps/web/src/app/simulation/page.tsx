"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function SimulationPage() {
  const [smiles, setSmiles] = useState("CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F");
  const [action, setAction] = useState("fep");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      let body: any = { action, ligand_smiles: smiles };
      if (action === "fep") body = { ...body, reference_smiles: "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F", n_lambda_windows: 12 };
      if (action === "md") body = { ...body, simulation_time_ns: 10, temperature_k: 300 };
      if (action === "conformer-search") body = { ...body, smiles, max_conformers: 50 };
      if (action === "water-map") body = { ...body, smiles };
      const res = await fetch("/api/simulation", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setResult(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Physics Simulation Engine</h1>
        <p className={styles.subtitle}>Free energy perturbation, molecular dynamics, conformer search, and water mapping</p>
      </header>
      <div className={styles.controls}>
        <div className={styles.tabs}>
          {["fep", "md", "conformer-search", "water-map"].map(a => (
            <button key={a} className={`${styles.tab} ${action === a ? styles.active : ""}`} onClick={() => setAction(a)}>{a.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}</button>
          ))}
        </div>
        <input className={styles.input} value={smiles} onChange={e => setSmiles(e.target.value)} placeholder="SMILES" />
        <button className={styles.button} onClick={run} disabled={loading}>{loading ? "Running..." : "Run"}</button>
      </div>
      {result && (
        <div className={styles.results}>
          {action === "fep" && (
            <div className={styles.section}>
              <div className={styles.bigValue}>ΔΔG = {result.ddg_kcal_mol} kcal/mol ± {result.ddg_error}</div>
              <div className={styles.affinity}>Predicted Affinity: {result.predicted_affinity_nm} nM</div>
              <div className={styles.windowGrid}>
                {result.windows?.map((w: any, i: number) => (
                  <div key={i} className={styles.window}>
                    λ={w.lambda_val} ΔG={w.dg_kcal_mol} err={w.error_estimate}
                  </div>
                ))}
              </div>
            </div>
          )}
          {action === "md" && (
            <div className={styles.section}>
              <div className={styles.mdStats}>
                <span>Avg RMSD: {result.average_rmsd} Å</span>
                <span>BE: {result.binding_free_energy_kcal_mol} kcal/mol</span>
                <span>Stability: {result.stability_assessment}</span>
              </div>
              <div className={styles.trajGrid}>
                {result.trajectory?.filter((_: any, i: number) => i % 5 === 0).map((t: any, i: number) => (
                  <div key={i} className={styles.trajPoint}>t={t.time_ns}ns RMSD={t.rmsd_a}Å E={t.energy_kcal_mol}</div>
                ))}
              </div>
              {result.key_interactions?.map((k: any, i: number) => (
                <div key={i} className={styles.interaction}>{k.type} @ {k.residue} ({(k.occupancy * 100).toFixed(0)}%)</div>
              ))}
            </div>
          )}
          {action === "conformer-search" && (
            <div className={styles.section}>
              <div className={styles.conformerStats}>Found {result.total_conformers} conformers | Global min: {result.global_minimum_energy} kcal/mol</div>
              <div className={styles.conformerGrid}>
                {result.conformers?.map((c: any, i: number) => (
                  <div key={i} className={styles.conformer}>
                    #{c.conformer_id} E={c.energy_kcal_mol} RMSD={c.rmsd_vs_global_min} Pop={(c.population_percent).toFixed(0)}%
                  </div>
                ))}
              </div>
            </div>
          )}
          {action === "water-map" && (
            <div className={styles.section}>
              <div className={styles.waterStats}>{result.displaceable_waters}/{result.total_waters} displaceable waters</div>
              <div className={styles.waterGrid}>
                {result.water_sites?.filter((w: any) => w.displaceable).slice(0, 10).map((w: any, i: number) => (
                  <div key={i} className={styles.waterSite}>E={w.energy_kcal_mol} Occ={w.occupancy} [{w.x.toFixed(1)},{w.y.toFixed(1)},{w.z.toFixed(1)}]</div>
                ))}
              </div>
            </div>
          )}
          <div className={styles.footer}>Inference: {result.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
