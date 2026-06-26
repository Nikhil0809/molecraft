"use client";

import { useMemo } from "react";
import styles from "./AmbientContextBar.module.css";

interface ContextMolecule {
  id: string;
  name: string;
  affinity: number;
  smiles: string;
}

interface AmbientContextBarProps {
  nodeCount: number;
  selectedNodeLabel: string | null;
  selectedNodeType: string | null;
  selectedMolecule: ContextMolecule | null;
  generationProgress: string;
  isGenerating: boolean;
  onOpenWhisper: () => void;
}

export function AmbientContextBar({
  nodeCount,
  selectedNodeLabel,
  selectedNodeType,
  selectedMolecule,
  generationProgress,
  isGenerating,
  onOpenWhisper,
}: AmbientContextBarProps) {
  const contextMessage = useMemo(() => {
    if (isGenerating) return generationProgress;
    if (selectedMolecule) {
      return `Inspecting ${selectedMolecule.name} · ${selectedMolecule.affinity} nM · type "/" to ask about this molecule`;
    }
    if (selectedNodeLabel) {
      return `${selectedNodeType}: ${selectedNodeLabel} · type "/" for contextual commands`;
    }
    if (nodeCount > 0) {
      return `${nodeCount} molecule${nodeCount !== 1 ? "s" : ""} on canvas · type "/" to search or filter`;
    }
    return "Canvas empty · type a query above to generate molecules";
  }, [isGenerating, generationProgress, selectedMolecule, selectedNodeLabel, selectedNodeType, nodeCount]);

  return (
    <div className={styles.bar}>
      <div className={styles.dock}>
        <div className={styles.context}>
          <span className={styles.icon}>
            {isGenerating ? "⟳" : selectedMolecule ? "◈" : selectedNodeLabel ? "◎" : "○"}
          </span>
          <span className={styles.message}>{contextMessage}</span>
        </div>

        <div className={styles.actions}>
          <button className={styles.chip} onClick={onOpenWhisper} title="Open ambient command">
            <kbd>/</kbd> command
          </button>
          <div className={styles.metrics}>
            <span className={styles.metric}>{nodeCount} nodes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
