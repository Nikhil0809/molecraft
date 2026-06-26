"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function LabPage() {
  const [smiles, setSmiles] = useState("CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async (action: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/lab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, smiles, scale_mg: 100 }),
      });
      setResult({ action, data: await res.json() });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Lab Automation & Synthesis</h1>
        <p className={styles.subtitle}>Retrosynthesis planning, automated reaction prediction, and robotic lab integration</p>
      </header>
      <div className={styles.controls}>
        <input className={styles.input} value={smiles} onChange={e => setSmiles(e.target.value)} placeholder="SMILES" />
        <button className={styles.btnRetro} onClick={() => run("retrosynthesis")} disabled={loading}>Retrosynthesis</button>
        <button className={styles.btnPlan} onClick={() => run("plan-synthesis")} disabled={loading}>Synthesis Plan</button>
        <button className={styles.btnOrder} onClick={() => run("order")} disabled={loading}>Find Vendors</button>
      </div>
      {result && (
        <div className={styles.results}>
          {result.action === "retrosynthesis" && (
            <div className={styles.section}>
              <div className={styles.sa}>Synthetic Accessibility: {result.data.synthetic_accessibility_score}/10</div>
              <div className={styles.routeGrid}>
                {result.data.routes?.map((r: any, i: number) => (
                  <div key={i} className={styles.route}>
                    <div className={styles.routeTitle}>Route {i + 1}: {r.reaction_type}</div>
                    <div className={styles.routeBody}>
                      <div>Yield: {(r.yield_estimate * 100).toFixed(0)}%</div>
                      <div>Cost: ${r.cost_per_gram}/g</div>
                      <div>Conditions: {r.conditions}</div>
                      <div>Precursors: {r.precursors?.slice(0, 3).join(", ")}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.action === "plan-synthesis" && (
            <div className={styles.section}>
              <div className={styles.planSummary}>
                <span>Steps: {result.data.total_steps}</span>
                <span>Total Yield: {result.data.total_yield}%</span>
                <span>Time: {result.data.estimated_time_hours}h</span>
                <span>Cost: ${result.data.reagent_cost}</span>
                <span>Robot: {result.data.recommended_platform}</span>
              </div>
              <div className={styles.stepGrid}>
                {result.data.steps?.map((s: any, i: number) => (
                  <div key={i} className={styles.step}>
                    <div className={styles.stepNum}>Step {s.step_number}</div>
                    <div className={styles.stepBody}>
                      <div className={styles.rxn}>{s.reaction}</div>
                      <div className={styles.cond}>{s.conditions}</div>
                      <div>Yield: {s.yield_percent}% | Duration: {s.duration_hours}h</div>
                      <div>Purification: {s.purification}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.action === "order" && (
            <div className={styles.section}>
              <div className={styles.vendorGrid}>
                {result.data.listings?.map((l: any, i: number) => (
                  <div key={i} className={styles.vendor}>
                    <div className={styles.vendorName}>{l.vendor}</div>
                    <div className={styles.vendorPrice}>${l.price_per_g}/g</div>
                    <div className={styles.vendorStatus}>{l.stock_status}</div>
                    <div className={styles.vendorLead}>{l.lead_time_days} days</div>
                  </div>
                ))}
              </div>
              {result.data.cheapest_option && <div className={styles.best}>Cheapest: {result.data.cheapest_option.vendor} @ ${result.data.cheapest_option.price_per_g}/g</div>}
            </div>
          )}
          <div className={styles.footer}>Inference: {result.data.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
