"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

export default function SettingsPage() {
  const [ragDepth, setRagDepth] = useState<"normal" | "deep" | "ultra">("deep");
  const [minMw, setMinMw] = useState(150);
  const [maxMw, setMaxMw] = useState(550);
  const [showAtomIndices, setShowAtomIndices] = useState(false);
  const [explicitMethyl, setExplicitMethyl] = useState(false);
  const [citationTier, setCitationTier] = useState<"all" | "t1_t2" | "t1">("t1_t2");
  const [highlightColor, setHighlightColor] = useState("#4F8EF7");
  const [pubmedKey, setPubmedKey] = useState("••••••••••••••••••••••••••••");
  const [chemblToken, setChemblToken] = useState("••••••••••••••••••••••••••••");
  const [showPubmed, setShowPubmed] = useState(false);
  const [showChembl, setShowChembl] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/user");
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setRagDepth(data.settings.ragDepth || "deep");
            setMinMw(data.settings.minMw || 150);
            setMaxMw(data.settings.maxMw || 550);
            setShowAtomIndices(data.settings.showAtomIndices || false);
            setExplicitMethyl(data.settings.explicitMethyl || false);
            setCitationTier(data.settings.citationTier || "t1_t2");
            setHighlightColor(data.settings.highlightColor || "#4F8EF7");
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ragDepth,
          citationTier,
          minMw,
          maxMw,
          showAtomIndices,
          explicitMethyl,
          highlightColor,
        }),
      });
      
      if (res.ok) {
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 3000);
      } else {
        alert("Failed to save settings.");
      }
    } catch (err) {
      console.error("Save settings error:", err);
      alert("An error occurred while saving settings.");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>System Settings</h1>
        <p className={styles.subtitle}>Configure molecule generation thresholds, RDKit parameters, and RAG configurations.</p>
      </header>

      <form onSubmit={handleSave} className={styles.form}>
        {/* RAG Pipeline Config */}
        <section className={styles.card} aria-label="RAG Search Configuration">
          <h2 className={styles.cardTitle}>RAG Search Pipeline</h2>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>RAG Retrieval Depth</label>
            <div className={styles.segmentedControl}>
              {(["normal", "deep", "ultra"] as const).map((depth) => (
                <button
                  key={depth}
                  type="button"
                  className={`${styles.segBtn} ${ragDepth === depth ? styles.segBtnActive : ""}`}
                  onClick={() => setRagDepth(depth)}
                >
                  {depth.toUpperCase()}
                </button>
              ))}
            </div>
            <span className={styles.hint}>
              Deep retrieves up to 50 articles. Ultra retrieves up to 150 articles and runs semantic ranking, increasing generation latency.
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Allowed Citation Sources</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="citationTier"
                  value="all"
                  checked={citationTier === "all"}
                  onChange={() => setCitationTier("all")}
                />
                All Sources (Tier 1, Tier 2 & Tier 3 Web references)
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="citationTier"
                  value="t1_t2"
                  checked={citationTier === "t1_t2"}
                  onChange={() => setCitationTier("t1_t2")}
                />
                Scientific Only (Tier 1 Peer-Reviewed & Tier 2 Preprints)
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="citationTier"
                  value="t1"
                  checked={citationTier === "t1"}
                  onChange={() => setCitationTier("t1")}
                />
                Peer-Reviewed Only (Strict Tier 1 ChEMBL & PubMed)
              </label>
            </div>
          </div>
        </section>

        {/* Molecular Generation Constraints */}
        <section className={styles.card} aria-label="Molecular Filter Bounds">
          <h2 className={styles.cardTitle}>Molecular Filters</h2>
          
          <div className={styles.rangeRow}>
            <div className={styles.rangeCol}>
              <label htmlFor="min-mw" className={styles.label}>Min Molecular Weight: {minMw} g/mol</label>
              <input
                id="min-mw"
                type="range"
                min="50"
                max="400"
                step="10"
                value={minMw}
                onChange={(e) => setMinMw(parseInt(e.target.value))}
                className={styles.slider}
              />
            </div>
            <div className={styles.rangeCol}>
              <label htmlFor="max-mw" className={styles.label}>Max Molecular Weight: {maxMw} g/mol</label>
              <input
                id="max-mw"
                type="range"
                min="400"
                max="1000"
                step="10"
                value={maxMw}
                onChange={(e) => setMaxMw(parseInt(e.target.value))}
                className={styles.slider}
              />
            </div>
          </div>
        </section>

        {/* RDKit Rendering Rules */}
        <section className={styles.card} aria-label="RDKit draw preferences">
          <h2 className={styles.cardTitle}>RDKit 2D Structure Rendering</h2>
          
          <div className={styles.checkboxGrid}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showAtomIndices}
                onChange={(e) => setShowAtomIndices(e.target.checked)}
              />
              Show Atom Indices on Canvas
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={explicitMethyl}
                onChange={(e) => setExplicitMethyl(e.target.checked)}
              />
              Draw Explicit Methyl Groups
            </label>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="highlight-color" className={styles.label}>Highlight Binding Pocket Color</label>
            <select
              id="highlight-color"
              value={highlightColor}
              onChange={(e) => setHighlightColor(e.target.value)}
              className={styles.select}
            >
              <option value="#4F8EF7">Active Blue (#4F8EF7)</option>
              <option value="#34C97E">Success Green (#34C97E)</option>
              <option value="#F5A623">Warning Gold (#F5A623)</option>
              <option value="#8B5CF6">Pocket Purple (#8B5CF6)</option>
            </select>
          </div>
        </section>

        {/* Credentials and API limits */}
        <section className={styles.card} aria-label="API Integration Credentials">
          <h2 className={styles.cardTitle}>API Integration Keys</h2>
          
          <div className={styles.formGroup}>
            <label htmlFor="pubmed-key" className={styles.label}>NCBI PubMed API Key</label>
            <div className={styles.inputWrapper}>
              <input
                id="pubmed-key"
                type={showPubmed ? "text" : "password"}
                value={pubmedKey}
                onChange={(e) => setPubmedKey(e.target.value)}
                className={styles.input}
              />
              <button
                type="button"
                className={styles.toggleVisibility}
                onClick={() => setShowPubmed(!showPubmed)}
              >
                {showPubmed ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="chembl-token" className={styles.label}>ChEMBL Web Service Auth Token</label>
            <div className={styles.inputWrapper}>
              <input
                id="chembl-token"
                type={showChembl ? "text" : "password"}
                value={chemblToken}
                onChange={(e) => setChemblToken(e.target.value)}
                className={styles.input}
              />
              <button
                type="button"
                className={styles.toggleVisibility}
                onClick={() => setShowChembl(!showChembl)}
              >
                {showChembl ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </section>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <button type="button" className={styles.resetBtn} onClick={() => alert("Settings reset to enterprise defaults.")}>
            Reset Defaults
          </button>
          <button type="submit" className={styles.saveBtn}>
            Save Changes
          </button>
        </div>
      </form>

      {/* Floating success toast */}
      {toastVisible && (
        <div className={styles.toast} role="status">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Configuration saved successfully.
        </div>
      )}
    </div>
  );
}
