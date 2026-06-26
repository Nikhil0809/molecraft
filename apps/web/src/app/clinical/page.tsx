"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function ClinicalPage() {
  const [disease, setDisease] = useState("alzheimer");
  const [phase, setPhase] = useState("phase2");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [patientMode, setPatientMode] = useState(false);
  const [patientCount, setPatientCount] = useState(100);

  const run = async () => {
    setLoading(true);
    try {
      if (patientMode) {
        const res = await fetch("/api/clinical", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "simulate-patients", n_patients: patientCount, disease }),
        });
        setResult(await res.json());
      } else {
        const res = await fetch("/api/clinical", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "design-trial", disease, phase, sample_size: phase === "phase1" ? 50 : phase === "phase2" ? 200 : 1000, duration_weeks: 24, expected_effect_size: 0.3, adaptive_design: true }),
        });
        setResult(await res.json());
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Clinical Trial Simulation</h1>
        <p className={styles.subtitle}>Design trials, simulate patient cohorts, and predict outcomes with digital twins</p>
      </header>
      <div className={styles.controls}>
        <select className={styles.select} value={disease} onChange={e => setDisease(e.target.value)}>
          {["alzheimer", "parkinson", "lung_cancer", "heart_failure", "diabetes_t2"].map(d => <option key={d} value={d}>{d.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
        </select>
        {!patientMode && <select className={styles.select} value={phase} onChange={e => setPhase(e.target.value)}>
          {["phase1", "phase2", "phase3"].map(p => <option key={p} value={p}>{p.replace("phase", "Phase ")}</option>)}
        </select>}
        <button className={styles.modeBtn} onClick={() => { setPatientMode(!patientMode); setResult(null); }}>
          {patientMode ? "Trial Design" : "Patient Simulation"}
        </button>
        {patientMode && <input className={styles.inputSmall} type="number" value={patientCount} onChange={e => setPatientCount(Number(e.target.value))} min={10} max={10000} />}
        <button className={styles.button} onClick={run} disabled={loading}>{loading ? "Running..." : "Run"}</button>
      </div>
      {result && (
        <div className={styles.results}>
          {result.arms ? (
            <>
              <div className={styles.trialInfo}>
                Trial: {result.trial_id} | Phase: {result.phase} | Patients: {result.total_patients} | Power: {(result.power * 100).toFixed(1)}% | Success Prob: {(result.predicted_success_probability * 100).toFixed(1)}% | Est. Cost: ${result.estimated_cost_millions}M
              </div>
              <div className={styles.grid}>
                {result.arms.map((arm: any, i: number) => (
                  <div key={i} className={styles.card}>
                    <div className={styles.cardHeader}>{arm.arm_name}</div>
                    <div className={styles.stat}>N: {arm.sample_size}</div>
                    <div className={styles.stat}>Effect Size: {arm.effect_size}</div>
                    <div className={styles.stat}>Dropout: {(arm.dropout_rate * 100).toFixed(0)}%</div>
                    <div className={styles.stat}>P-value: {arm.p_value}</div>
                  </div>
                ))}
              </div>
              {result.adaptive_features?.length > 0 && (
                <div className={styles.adaptive}>Adaptive: {result.adaptive_features.join(", ")}</div>
              )}
            </>
          ) : result.cohort_statistics ? (
            <div className={styles.patientStats}>
              <div className={styles.statGrid}>
                <div className={styles.statCard}><strong>{result.cohort_statistics.n_patients}</strong><span>Patients</span></div>
                <div className={styles.statCard}><strong>{result.cohort_statistics.mean_age}</strong><span>Mean Age</span></div>
                <div className={styles.statCard}><strong>{(result.cohort_statistics.sex_ratio_male * 100).toFixed(0)}%</strong><span>Male</span></div>
                <div className={styles.statCard}><strong>{result.cohort_statistics.mean_bmi}</strong><span>Mean BMI</span></div>
              </div>
              {result.patients?.slice(0, 5).map((p: any, i: number) => (
                <div key={i} className={styles.patientRow}>
                  Age {p.age} | BMI {p.bmi} | Dropout: {(p.dropout_risk * 100).toFixed(0)}% | AE: {(p.adverse_event_risk * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          ) : null}
          <div className={styles.footer}>Inference: {result.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
