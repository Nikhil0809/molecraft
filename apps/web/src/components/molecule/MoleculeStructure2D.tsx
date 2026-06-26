"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./MoleculeStructure2D.module.css";

interface MoleculeStructure2DProps {
  smiles: string;
  name?: string;
  width?: number;
  height?: number;
}

declare global {
  interface Window {
    RDKit: RDKitModule;
    initRDKitModule: () => Promise<RDKitModule>;
  }
}

interface RDKitModule {
  get_mol: (smiles: string) => RDMol;
}
interface RDMol {
  is_valid: () => boolean;
  get_svg_with_highlights: (details: string) => string;
  delete: () => void;
}

let rdkitPromise: Promise<RDKitModule> | null = null;
let rdkitInstance: RDKitModule | null = null;

function loadRDKit(): Promise<RDKitModule> {
  if (rdkitInstance) return Promise.resolve(rdkitInstance);
  if (rdkitPromise) return rdkitPromise;

  rdkitPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Not in browser"));
      return;
    }

    // Check if already loaded
    if (window.RDKit) {
      rdkitInstance = window.RDKit;
      resolve(rdkitInstance);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/@rdkit/rdkit@2024.9.5/dist/RDKit_minimal.js";
    script.async = true;

    script.onload = () => {
      if (window.initRDKitModule) {
        window
          .initRDKitModule()
          .then((RDKit: RDKitModule) => {
            window.RDKit = RDKit;
            rdkitInstance = RDKit;
            resolve(RDKit);
          })
          .catch(reject);
      } else {
        reject(new Error("RDKit init function not found"));
      }
    };

    script.onerror = () => reject(new Error("Failed to load RDKit"));
    document.head.appendChild(script);
  });

  return rdkitPromise;
}

export function MoleculeStructure2D({
  smiles,
  name,
  width = 260,
  height = 160,
}: MoleculeStructure2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const RDKit = await loadRDKit();
        if (cancelled) return;

        const mol = RDKit.get_mol(smiles);
        if (!mol || !mol.is_valid()) {
          mol?.delete();
          throw new Error("Invalid SMILES");
        }

        const svg = mol.get_svg_with_highlights(
          JSON.stringify({
            width,
            height,
            bondLineWidth: 1.5,
            addAtomIndices: false,
            explicitMethyl: false,
            backgroundColour: [0, 0, 0, 0],
            highlightColour: [0.31, 0.56, 0.97],
          })
        );
        mol.delete();

        if (cancelled) return;

        if (containerRef.current) {
          // Replace black atom labels with light text for dark theme
          const themedSvg = svg
            .replace(/fill:#000000/g, "fill:#F0F2F8")
            .replace(/stroke:#000000/g, "stroke:#F0F2F8")
            .replace(/fill='#000000'/g, "fill='#F0F2F8'")
            .replace(/stroke='#000000'/g, "stroke='#F0F2F8'");
          containerRef.current.innerHTML = themedSvg;
          setStatus("ready");
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Rendering failed");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [smiles, width, height]);

  const altText = name
    ? `2D structure of ${name}`
    : `2D molecular structure for SMILES: ${smiles}`;

  if (status === "error") {
    return (
      <div className={styles.fallback}>
        <code className={styles.fallbackSmiles}>{smiles}</code>
        <span className={styles.fallbackNote}>
          Structure rendering unavailable{errorMsg ? `: ${errorMsg}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.container} role="img" aria-label={altText}>
      {status === "loading" && (
        <div className={styles.skeleton} style={{ width, height }} />
      )}
      <div
        ref={containerRef}
        className={`${styles.svgContainer} ${status === "ready" ? styles.visible : styles.hidden}`}
      />
    </div>
  );
}
