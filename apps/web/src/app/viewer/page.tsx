"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MoleculeStructure2D } from "@/components/molecule/MoleculeStructure2D";
import styles from "./page.module.css";

const HolographicMolecule = dynamic(
  () => import("@/components/molecule/HolographicMolecule"),
  { ssr: false }
);

const EXAMPLES = [
  { label: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { label: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" },
  { label: "Penicillin G", smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)Cc3ccccc3)C(=O)O)C" },
  { label: "Morphine", smiles: "CN1CC[C@]23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5" },
  { label: "Ibuprofen", smiles: "CC(C)Cc1ccc(cc1)[C@@H](C)C(=O)O" },
  { label: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1" },
];

function parseMolInfo(smiles: string) {
  const carbon = (smiles.match(/C/g) || []).length;
  const oxygen = (smiles.match(/O/g) || []).length;
  const nitrogen = (smiles.match(/N/g) || []).length;
  const rings = (smiles.match(/\d/g) || []).length;
  return { formula: `C${carbon}H${Math.round(carbon * 1.8)}N${nitrogen}O${oxygen}`, weight: carbon * 12 + oxygen * 16 + nitrogen * 14 + carbon * 1.8, rings: Math.floor(rings / 2) };
}

export default function ViewerPage() {
  const [smiles, setSmiles] = useState("CC(=O)Oc1ccccc1C(=O)O");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  const [autoRotate, setAutoRotate] = useState(true);
  const [showESP, setShowESP] = useState(true);
  const info = parseMolInfo(smiles);

  return (
    <div className={styles.page}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>SMILES Viewer</div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Enter SMILES</label>
          <input
            className={styles.input}
            type="text"
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            placeholder="Paste a SMILES string..."
            spellCheck={false}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Examples</label>
          <div className={styles.examples}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                className={`${styles.exampleBtn} ${smiles === ex.smiles ? styles.exampleActive : ""}`}
                onClick={() => setSmiles(ex.smiles)}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.inputGroup}>
          <label className={styles.label}>Display</label>
          <div className={styles.toggleGroup}>
            <button
              className={`${styles.toggleBtn} ${viewMode === "3d" ? styles.toggleActive : ""}`}
              onClick={() => setViewMode("3d")}
            >
              3D Holographic
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === "2d" ? styles.toggleActive : ""}`}
              onClick={() => setViewMode("2d")}
            >
              2D Structure
            </button>
          </div>
        </div>

        {viewMode === "3d" && (
          <div className={styles.inputGroup}>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
              <span>Auto-rotate</span>
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={showESP} onChange={(e) => setShowESP(e.target.checked)} />
              <span>ESP coloring</span>
            </label>
          </div>
        )}

        <div className={styles.divider} />

        <div className={styles.properties}>
          <div className={styles.propRow}>
            <span className={styles.propLabel}>Formula</span>
            <span className={styles.propValue}>{info.formula}</span>
          </div>
          <div className={styles.propRow}>
            <span className={styles.propLabel}>MW</span>
            <span className={styles.propValue}>{info.weight.toFixed(1)} g/mol</span>
          </div>
          <div className={styles.propRow}>
            <span className={styles.propLabel}>Rings</span>
            <span className={styles.propValue}>{info.rings}</span>
          </div>
          <div className={styles.propRow}>
            <span className={styles.propLabel}>Atoms</span>
            <span className={styles.propValue}>{smiles.match(/[A-Z][a-z]?/g)?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className={styles.viewer}>
        {viewMode === "3d" ? (
          <HolographicMolecule
            smiles={smiles}
            width={Math.min(600, typeof window !== "undefined" ? window.innerWidth - 320 : 600)}
            height={Math.min(600, typeof window !== "undefined" ? window.innerHeight - 100 : 600)}
            interactive
            showESP={showESP}
          />
        ) : (
          <div className={styles.viewer2d}>
            <MoleculeStructure2D smiles={smiles} width={500} height={500} />
          </div>
        )}
      </div>
    </div>
  );
}
