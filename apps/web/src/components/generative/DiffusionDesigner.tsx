"use client";

import { useState, useCallback, useRef } from "react";
import styles from "./DiffusionDesigner.module.css";

export interface ADMETConstraintsInput {
  max_logp?: number;
  min_qed?: number;
  max_sa_score?: number;
  max_mw?: number;
  max_hbd?: number;
  max_hba?: number;
  max_tpsa?: number;
  max_rotatable?: number;
}

export interface DiffusionResult {
  id: string;
  smiles: string;
  name: string;
  formula: string;
  affinity: number;
  qed: number;
  saScore: number;
  molWeight: number;
  logP: number;
  ipRisk: string;
  ipDetails: Record<string, unknown>;
  synthesisRoutes: Array<{
    template?: string;
    name?: string;
    reactants?: string[];
    score?: number;
    description?: string;
  }>;
  properties: Record<string, number>;
}

interface DiffusionDesignerProps {
  onResults: (results: DiffusionResult[], sources: Array<{ name: string; status: string; resultCount: number; message: string }>) => void;
  onGenerationStart: (progressText: string) => void;
  onGenerationEnd: () => void;
  onError: (message: string) => void;
  onClose?: () => void;
}

const PRESET_TARGETS = [
  { label: "EGFR (P00533)", uniprot: "P00533", name: "Epidermal growth factor receptor" },
  { label: "BRAF (P15056)", uniprot: "P15056", name: "Serine/threonine-protein kinase B-raf" },
  { label: "JAK1 (P23458)", uniprot: "P23458", name: "Tyrosine-protein kinase JAK1" },
  { label: "COX-2 (P35354)", uniprot: "P35354", name: "Prostaglandin G/H synthase 2" },
  { label: "PD-L1 (Q9NZQ7)", uniprot: "Q9NZQ7", name: "Programmed death-ligand 1" },
  { label: "HER2 (P04626)", uniprot: "P04626", name: "Receptor tyrosine-protein kinase erbB-2" },
];

export function DiffusionDesigner({
  onResults,
  onGenerationStart,
  onGenerationEnd,
  onError,
  onClose,
}: DiffusionDesignerProps) {
  const [targetUniprot, setTargetUniprot] = useState("P00533");
  const [targetName, setTargetName] = useState("");
  const [pdbPath, setPdbPath] = useState("");
  const [pocketRadius, setPocketRadius] = useState(10);
  const [nSamples, setNSamples] = useState(100);
  const [nFinal, setNFinal] = useState(20);
  const [affinityTarget, setAffinityTarget] = useState<number | "">("");
  const [guidanceScale, setGuidanceScale] = useState(3.0);
  const [samplingSteps, setSamplingSteps] = useState(50);
  const [saThreshold, setSaThreshold] = useState(4.0);
  const [qedThreshold, setQedThreshold] = useState(0.4);
  const [applySynthesis, setApplySynthesis] = useState(true);
  const [applyIp, setApplyIp] = useState(true);
  const [ipThreshold, setIpThreshold] = useState(0.8);
  const [seed, setSeed] = useState<number | "">("");
  const [expanded, setExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");

  const handlePreset = useCallback((uniprot: string, name: string) => {
    setTargetUniprot(uniprot);
    setTargetName(name);
    setPdbPath("");
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!targetUniprot && !pdbPath) {
      onError("Please provide a target (UniProt ID or PDB file path)");
      return;
    }

    setIsGenerating(true);
    setProgress("Preparing pocket representation...");
    onGenerationStart("Pocket-conditioned diffusion generation starting...");

    const payload = {
      target_uniprot: targetUniprot || null,
      target_pdb: pdbPath || null,
      pocket_radius: pocketRadius,
      n_samples: nSamples,
      n_final: nFinal,
      affinity_target_nm: affinityTarget === "" ? null : Number(affinityTarget),
      admet_constraints: {
        max_sa_score: saThreshold,
        min_qed: qedThreshold,
      },
      sa_threshold: saThreshold,
      qed_threshold: qedThreshold,
      apply_synthesis_filter: applySynthesis,
      apply_ip_filter: applyIp,
      ip_similarity_threshold: ipThreshold,
      guidance_scale: guidanceScale,
      sampling_steps: samplingSteps,
      seed: seed === "" ? null : Number(seed),
      query: targetName || targetUniprot,
    };

    try {
      setProgress("Calling diffusion service...");
      const resp = await fetch("/api/generate-diffusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (resp.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || "Diffusion generation failed");
      }

      const data = await resp.json();
      onResults(data.molecules || [], data.sources || []);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
      setProgress("");
      onGenerationEnd();
    }
  }, [
    targetUniprot, pdbPath, targetName, pocketRadius, nSamples, nFinal,
    affinityTarget, saThreshold, qedThreshold, applySynthesis, applyIp,
    ipThreshold, guidanceScale, samplingSteps, seed,
    onResults, onGenerationStart, onGenerationEnd, onError,
  ]);

  return (
    <div className={`${styles.container} ${expanded ? styles.expanded : ""}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft} onClick={() => setExpanded(!expanded)}>
          <span className={styles.icon}>🧬</span>
          <div>
            <h3 className={styles.title}>Pocket-Conditioned Diffusion</h3>
            <p className={styles.subtitle}>3D equivariant generative model with multi-objective guidance</p>
          </div>
        </div>
        <button className={styles.toggle} onClick={() => setExpanded(!expanded)}>{expanded ? "−" : "+"}</button>
        {onClose && (
          <button className={styles.close} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Target Pocket</label>
            <div className={styles.presetGrid}>
              {PRESET_TARGETS.map((t) => (
                <button
                  key={t.uniprot}
                  className={`${styles.preset} ${targetUniprot === t.uniprot ? styles.presetActive : ""}`}
                  onClick={() => handlePreset(t.uniprot, t.name)}
                >
                  <span className={styles.presetLabel}>{t.label}</span>
                  <span className={styles.presetName}>{t.name}</span>
                </button>
              ))}
            </div>

            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>UniProt ID</label>
                <input
                  type="text"
                  className={styles.input}
                  value={targetUniprot}
                  onChange={(e) => setTargetUniprot(e.target.value.toUpperCase())}
                  placeholder="P00533"
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Or PDB File Path</label>
                <input
                  type="text"
                  className={styles.input}
                  value={pdbPath}
                  onChange={(e) => setPdbPath(e.target.value)}
                  placeholder="/data/pdbs/1m17.pdb"
                />
              </div>
            </div>

            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  Pocket Radius: <span className={styles.value}>{pocketRadius} Å</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  className={styles.slider}
                  value={pocketRadius}
                  onChange={(e) => setPocketRadius(Number(e.target.value))}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Target Name (optional)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="Epidermal growth factor receptor"
                />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>Generation Parameters</label>
            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Samples</label>
                <input
                  type="number"
                  className={styles.input}
                  value={nSamples}
                  min={10}
                  max={500}
                  onChange={(e) => setNSamples(Number(e.target.value))}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Keep Best</label>
                <input
                  type="number"
                  className={styles.input}
                  value={nFinal}
                  min={1}
                  max={100}
                  onChange={(e) => setNFinal(Number(e.target.value))}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Affinity Target (nM)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={affinityTarget}
                  min={0.01}
                  max={10000}
                  placeholder="100"
                  onChange={(e) => setAffinityTarget(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Seed</label>
                <input
                  type="number"
                  className={styles.input}
                  value={seed}
                  placeholder="random"
                  onChange={(e) => setSeed(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  Guidance Scale: <span className={styles.value}>{guidanceScale.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  className={styles.slider}
                  value={guidanceScale}
                  onChange={(e) => setGuidanceScale(Number(e.target.value))}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  Sampling Steps: <span className={styles.value}>{samplingSteps}</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  className={styles.slider}
                  value={samplingSteps}
                  onChange={(e) => setSamplingSteps(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.sectionLabel}>Property Filters</label>
            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Max SA Score</label>
                <input
                  type="number"
                  className={styles.input}
                  value={saThreshold}
                  min={1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setSaThreshold(Number(e.target.value))}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Min QED</label>
                <input
                  type="number"
                  className={styles.input}
                  value={qedThreshold}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(e) => setQedThreshold(Number(e.target.value))}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>IP Similarity Threshold</label>
                <input
                  type="number"
                  className={styles.input}
                  value={ipThreshold}
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  onChange={(e) => setIpThreshold(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.checkboxRow}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={applySynthesis}
                  onChange={(e) => setApplySynthesis(e.target.checked)}
                />
                <span>Synthesis feasibility filter (ASKCOS)</span>
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={applyIp}
                  onChange={(e) => setApplyIp(e.target.checked)}
                />
                <span>Patent / IP conflict screening</span>
              </label>
            </div>
          </div>

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className={styles.spinner} />
                {progress || "Generating..."}
              </>
            ) : (
              <>🚀 Generate Molecules</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}