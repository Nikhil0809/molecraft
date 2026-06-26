import styles from "./MoleculeCard.module.css";
import { MoleculeStructure2D } from "./MoleculeStructure2D";
import { AffinityBadge } from "./AffinityBadge";
import { ConfidenceInterval } from "./ConfidenceInterval";
import { ValidationLabel } from "./ValidationLabel";
import { MoleculeActions } from "./MoleculeActions";

export interface MoleculeData {
  id: string;
  smiles: string;
  name?: string;
  affinity: number;
  unit: string;
  ciLow: number;
  ciHigh: number;
  validationMethod: string;
  formula?: string;
  isSaved?: boolean;
  molWeight?: number;
  logP?: number;
  hbDonors?: number;
  hbAcceptors?: number;
  qed?: number;
  saScore?: number;
}

interface MoleculeCardProps {
  molecule: MoleculeData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  index?: number;
  onToggleSave?: (moleculeId: string, isSaved: boolean) => void;
}

export function MoleculeCard({ molecule, isSelected, onSelect, index = 0, onToggleSave }: MoleculeCardProps) {
  return (
    <article
      className={`${styles.card} ${isSelected ? styles.selected : ""}`}
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={() => onSelect?.(molecule.id)}
      tabIndex={0}
      role="button"
      aria-label={`Molecule ${molecule.name || molecule.id}: binding affinity ${molecule.affinity} ${molecule.unit}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(molecule.id);
        }
      }}
    >
      <div className={styles.structureArea}>
        <MoleculeStructure2D smiles={molecule.smiles} name={molecule.name} />
      </div>

      <div className={styles.infoArea}>
        {molecule.name && (
          <h3 className={styles.moleculeName}>{molecule.name}</h3>
        )}
        <div className={styles.smilesRow}>
          <code className={styles.smiles} aria-label={`SMILES notation: ${molecule.smiles}`}>
            {molecule.smiles}
          </code>
        </div>

        <div className={styles.metricsRow}>
          <AffinityBadge value={molecule.affinity} unit={molecule.unit} />
          <ConfidenceInterval low={molecule.ciLow} high={molecule.ciHigh} />
        </div>

        <div className={styles.bottomRow}>
          <ValidationLabel method={molecule.validationMethod} />
          <MoleculeActions 
            smiles={molecule.smiles} 
            moleculeId={molecule.id} 
            isSaved={molecule.isSaved} 
            onToggleSave={(saved) => onToggleSave?.(molecule.id, saved)}
          />
        </div>
      </div>
    </article>
  );
}
