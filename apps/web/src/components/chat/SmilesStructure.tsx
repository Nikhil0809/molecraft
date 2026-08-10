"use client";

import { useEffect, useRef, useState } from "react";
import SmilesDrawer from "smiles-drawer";
import styles from "./SmilesStructure.module.css";

interface SmilesStructureProps {
  smiles: string;
  width?: number;
  height?: number;
}

export function SmilesStructure({ smiles, width = 220, height = 140 }: SmilesStructureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    SmilesDrawer.parse(
      smiles,
      (tree) => {
        if (cancelled || !canvasRef.current) return;
        try {
          const drawer = new SmilesDrawer.Drawer({
            width,
            height,
            padding: 12,
            bondThickness: 1.1,
            bondSpacing: 0.18 * width,
            atomVisualization: "default",
          });
          drawer.draw(tree, canvasRef.current, "dark", false, []);
          if (!cancelled) setStatus("ready");
        } catch {
          if (!cancelled) setStatus("error");
        }
      },
      (e) => {
        if (cancelled) return;
        setStatus("error");
        setError(e?.message || "Invalid SMILES");
      }
    );

    return () => {
      cancelled = true;
    };
  }, [smiles, width, height]);

  if (status === "error") {
    return (
      <div className={styles.fallback}>
        <code className={styles.fallbackSmiles}>{smiles}</code>
        <span className={styles.fallbackNote}>
          Structure unavailable{error ? `: ${error}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.container} role="img" aria-label={`2D structure for SMILES ${smiles}`}>
      {status === "loading" && <div className={styles.skeleton} style={{ width, height }} />}
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${status === "ready" ? styles.visible : styles.hidden}`}
        width={width}
        height={height}
      />
    </div>
  );
}