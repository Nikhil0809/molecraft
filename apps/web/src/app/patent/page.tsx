"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function PatentPage() {
  const [query, setQuery] = useState("EGFR inhibitors");
  const [smiles, setSmiles] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<"search" | "fto" | "novelty">("search");

  const run = async () => {
    setLoading(true);
    try {
      let body: any = { action: mode };
      if (mode === "search") body = { ...body, query, max_results: 15, date_range: [2020, 2026] };
      else if (mode === "fto") body = { ...body, smiles, target: query };
      else if (mode === "novelty") body = { ...body, smiles, databases: ["patents", "pubchem"] };
      const res = await fetch("/api/patent", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setResult(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Patent IP Intelligence</h1>
        <p className={styles.subtitle}>Patent search, freedom-to-operate analysis, and novelty assessment</p>
      </header>
      <div className={styles.controls}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${mode === "search" ? styles.active : ""}`} onClick={() => setMode("search")}>Search</button>
          <button className={`${styles.tab} ${mode === "fto" ? styles.active : ""}`} onClick={() => setMode("fto")}>FTO</button>
          <button className={`${styles.tab} ${mode === "novelty" ? styles.active : ""}`} onClick={() => setMode("novelty")}>Novelty</button>
        </div>
        {mode === "search" && <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patents by target, disease, or company" />}
        {(mode === "fto" || mode === "novelty") && <input className={styles.input} value={smiles} onChange={e => setSmiles(e.target.value)} placeholder="SMILES" />}
        <button className={styles.button} onClick={run} disabled={loading}>{loading ? "Searching..." : "Run"}</button>
      </div>
      {result && (
        <div className={styles.results}>
          {mode === "search" && result.patents && (
            <div className={styles.section}>
              <div className={styles.searchSummary}>Found {result.total_results} results | {result.landscape_summary?.granted} granted | {result.landscape_summary?.published} published</div>
              <div className={styles.patentGrid}>
                {result.patents.map((p: any, i: number) => (
                  <div key={i} className={styles.patent}>
                    <div className={styles.patentNum}>{p.patent_number}</div>
                    <div className={styles.patentTitle}>{p.title}</div>
                    <div className={styles.patentMeta}>
                      <span>{p.assignee}</span> <span>{p.year}</span> <span className={styles[p.status]}>{p.status}</span>
                      <span>Score: {(p.relevance_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              {result.top_assignees && <div className={styles.assignees}>Top: {result.top_assignees.map((a: any) => `${a.name} (${a.count})`).join(" | ")}</div>}
            </div>
          )}
          {mode === "fto" && (
            <div className={styles.section}>
              <div className={styles.ftoSummary}>High Risk: {result.high_risk_patents?.length} | Medium Risk: {result.medium_risk_patents?.length} | Density: {result.landscape_density}</div>
              {result.high_risk_patents?.map((p: any, i: number) => (
                <div key={i} className={`${styles.riskCard} ${styles.highRisk}`}>
                  <div className={styles.riskNum}>{p.patent_number}</div>
                  <div>{p.title} — {p.assignee}</div>
                </div>
              ))}
              {result.recommendations?.map((r: any, i: number) => (
                <div key={i} className={styles.rec}>→ {r}</div>
              ))}
            </div>
          )}
          {mode === "novelty" && (
            <div className={styles.section}>
              <div className={styles.noveltyScore}>Novelty Score: {(result.novelty_score * 100).toFixed(0)}% — {result.structural_novelty_assessment}</div>
              <div className={styles.noveltyStatus}>{result.is_novel ? "Novel compound" : "Prior art found"}</div>
              {result.closest_prior_art?.map((a: any, i: number) => (
                <div key={i} className={styles.priorArt}>{a.source} (Tanimoto: {a.similarity})</div>
              ))}
            </div>
          )}
          <div className={styles.footer}>Inference: {result.inference_ms}ms</div>
        </div>
      )}
    </div>
  );
}
