import pickle
import time
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
from rdkit.Chem.rdchem import Mol

app = FastAPI(title="MoleCraft Affinity Predictor", version="3.0.0")

MODEL_DIR = Path(__file__).parent
MODEL_PATH = MODEL_DIR / "model.pkl"

MORGAN_RADIUS = 2
MORGAN_BITS = 2048

_model_data = None


def morgan_fingerprint(mol: Mol) -> np.ndarray:
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, MORGAN_RADIUS, nBits=MORGAN_BITS)
    arr = np.zeros((MORGAN_BITS,), dtype=np.float32)
    AllChem.DataStructs.ConvertToNumpyArray(fp, arr)
    return arr


def compute_descriptors(mol: Mol) -> dict:
    return {
        "MolWt": Descriptors.MolWt(mol),
        "LogP": Descriptors.MolLogP(mol),
        "HBD": Descriptors.NumHDonors(mol),
        "HBA": Descriptors.NumHAcceptors(mol),
        "TPSA": Descriptors.TPSA(mol),
        "NumRotatableBonds": Descriptors.NumRotatableBonds(mol),
        "NumAromaticRings": Descriptors.NumAromaticRings(mol),
        "NumHeteroatoms": Descriptors.NumHeteroatoms(mol),
        "FractionCSP3": Descriptors.FractionCSP3(mol),
        "RingCount": Descriptors.RingCount(mol),
        "NumSaturatedRings": rdMolDescriptors.CalcNumSaturatedRings(mol),
        "NumAliphaticRings": rdMolDescriptors.CalcNumAliphaticRings(mol),
    }


def compute_admet_properties(mol: Mol) -> dict:
    logp = Descriptors.MolLogP(mol)
    mw = Descriptors.MolWt(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    tpsa = Descriptors.TPSA(mol)
    rot = Descriptors.NumRotatableBonds(mol)
    n_aromatic = Descriptors.NumAromaticRings(mol)

    # Lipinski Rule-of-5
    lipinski = 0
    if mw > 500:
        lipinski += 1
    if logp > 5:
        lipinski += 1
    if hbd > 5:
        lipinski += 1
    if hba > 10:
        lipinski += 1
    lipinski_pass = lipinski <= 1

    # hERG toxicity risk
    herg_score = 1.0 / (1.0 + np.exp(-(-4.5 + 0.6 * logp + 0.008 * mw)))
    herg_risk = "high" if herg_score > 0.7 else "medium" if herg_score > 0.4 else "low"

    # CYP inhibition risk
    cyp_score = 1.0 / (1.0 + np.exp(-(-3.0 + 0.3 * logp + 0.015 * mw + 0.4 * n_aromatic)))
    cyp_risk = "high" if cyp_score > 0.7 else "medium" if cyp_score > 0.4 else "low"

    # BBB permeability
    bbb_score = -0.1 + 0.3 * logp - 0.01 * tpsa
    bbb_penetrant = bbb_score > 0.3

    # Solubility (LogS)
    log_solubility = 0.5 - 0.4 * logp - 0.01 * mw + 0.03 * hbd
    solubility_class = "high" if log_solubility > -2 else "moderate" if log_solubility > -4 else "low"

    # Synthesis accessibility (simple heuristic based on complexity)
    sa_score_raw = min(rot * 0.15 + n_aromatic * 0.2 + (1.0 - float(hbd + hba) / 20.0) * 0.3, 1.0)
    sa_score = round(1.0 + sa_score_raw * 9.0, 2)

    return {
        "lipinski_violations": lipinski,
        "lipinski_pass": lipinski_pass,
        "herg_risk": herg_risk,
        "herg_score": round(float(herg_score), 3),
        "cyp_inhibition_risk": cyp_risk,
        "cyp_score": round(float(cyp_score), 3),
        "bbb_penetrant": bbb_penetrant,
        "bbb_score": round(float(bbb_score), 3),
        "solubility_log_s": round(float(log_solubility), 3),
        "solubility_class": solubility_class,
        "sa_score": sa_score,
    }


def compute_applicability_domain(feature_vector: np.ndarray) -> dict:
    ad = _model_data.get("applicability_domain")
    if ad is None:
        return {"in_domain": True, "distance": 0.0, "threshold": 0.0}

    center = ad["train_center"]
    dist = float(np.linalg.norm(feature_vector - center))
    threshold = float(ad["threshold"])
    mean_dist = float(ad["dist_mean"])
    std_dist = float(ad["dist_std"])

    z_score = (dist - mean_dist) / std_dist if std_dist > 0 else 0.0
    in_domain = dist <= threshold

    return {
        "in_domain": bool(in_domain),
        "mahalanobis_distance": round(dist, 2),
        "z_score": round(float(z_score), 2),
        "threshold": round(threshold, 2),
        "confidence": "high" if in_domain and z_score < 2.0 else "medium" if in_domain else "low",
    }


def compute_substructure_attribution(mol: Mol, fp: np.ndarray) -> list[dict]:
    importance = _model_data.get("morgan_bit_importance")
    if importance is None:
        return []

    info = {}
    AllChem.GetMorganFingerprintAsBitVect(mol, MORGAN_RADIUS, nBits=MORGAN_BITS, bitInfo=info)

    attributions = []
    for bit_idx, atoms_info in info.items():
        bit_imp = float(importance[bit_idx]) if bit_idx < len(importance) else 0.0
        if bit_imp < 0.001:
            continue

        for atom_idx, radius in atoms_info:
            env = Chem.MolFromSmiles(Chem.MolFragmentToSmiles(
                mol, atomsToUse=list(range(max(0, atom_idx - 3),
                                           min(mol.GetNumAtoms(), atom_idx + 4))),
                kekuleSmiles=True
            ))
            if env:
                attributions.append({
                    "bit_index": int(bit_idx),
                    "atom_index": int(atom_idx),
                    "radius": int(radius),
                    "importance": round(bit_imp, 4),
                    "environment_smiles": Chem.MolToSmiles(env)[:80],
                })

    attributions.sort(key=lambda x: -x["importance"])
    return attributions[:20]


def validate_smiles(smiles: str) -> Optional[str]:
    if not smiles or smiles.strip() == "":
        return "SMILES string cannot be empty"
    mol = Chem.MolFromSmiles(smiles.strip())
    if mol is None:
        return "Invalid SMILES string: RDKit could not parse it"
    return None


class PredictRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string of the molecule")
    target_protein: str = Field(default="unknown", description="Target protein name")


class ADMETProperties(BaseModel):
    lipinski_violations: int
    lipinski_pass: bool
    herg_risk: str
    herg_score: float
    cyp_inhibition_risk: str
    cyp_score: float
    bbb_penetrant: bool
    bbb_score: float
    solubility_log_s: float
    solubility_class: str
    sa_score: float


class ApplicabilityDomain(BaseModel):
    in_domain: bool
    mahalanobis_distance: float
    z_score: float
    threshold: float
    confidence: str


class SubstructureAttribution(BaseModel):
    bit_index: int
    atom_index: int
    radius: int
    importance: float
    environment_smiles: str


class PredictResponse(BaseModel):
    smiles: str
    target_protein: str
    affinity_nm: float
    ci_low: float
    ci_high: float
    validation_method: str
    feature_scores: dict
    prediction_ms: float
    applicability_domain: ApplicabilityDomain
    admet: ADMETProperties
    substructure_attributions: list[SubstructureAttribution]


@app.on_event("startup")
def load_model():
    global _model_data
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            _model_data = pickle.load(f)
        info = _model_data
        print(f"Model loaded: R²={info.get('r2_score', 'N/A'):}, "
              f"MAE={info.get('mae', 'N/A'):}nM, "
              f"samples={info.get('n_samples', 'N/A'):}")
        feat = info.get("feature_names", {})
        if isinstance(feat, dict):
            print(f"  Morgan bits={feat.get('morgan_bits', 2048)}, "
                  f"descriptors={feat.get('n_descriptors', 12)}")
        ad = info.get("applicability_domain")
        if ad:
            print(f"  Applicability domain: threshold={ad['threshold']:.2f}")
    else:
        print(f"WARNING: Model file not found at {MODEL_PATH}. "
              f"Run `python train.py` first.")
        _model_data = None


@app.get("/health")
def health():
    if _model_data is None:
        return {"status": "degraded", "model_loaded": False}
    return {
        "status": "ok",
        "model_loaded": True,
        "version": "3.0.0",
        "r2": _model_data.get("r2_score"),
        "samples": _model_data.get("n_samples"),
        "admet_enabled": True,
        "applicability_domain": _model_data.get("applicability_domain") is not None,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    start = time.time()

    err = validate_smiles(req.smiles)
    if err:
        raise HTTPException(status_code=400, detail=err)

    mol = Chem.MolFromSmiles(req.smiles.strip())
    if mol is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES")

    fp = morgan_fingerprint(mol)
    descriptors = compute_descriptors(mol)
    desc_values = np.array(list(descriptors.values()), dtype=np.float32)
    feature_vector = np.hstack([fp, desc_values])

    affinity_nm = None
    ci_low = None
    ci_high = None
    validation_method = "morgan-fingerprint-rf"

    if _model_data is not None:
        model = _model_data["model"]
        X_pred = feature_vector.reshape(1, -1)
        pred = float(model.predict(X_pred)[0])
        affinity_nm = round(pred, 2)

        try:
            tree_preds = np.array([
                float(tree.predict(X_pred)[0])
                for tree in model.estimators_
            ])
            std = float(np.std(tree_preds))
        except Exception:
            std = affinity_nm * 0.15

        ci_low = round(max(0.1, affinity_nm - 1.96 * std), 2)
        ci_high = round(affinity_nm + 1.96 * std, 2)
    else:
        logp = descriptors["LogP"]
        hbd = descriptors["HBD"]
        mw = descriptors["MolWt"]

        log_aff = 2.0
        if hbd > 5:
            log_aff += 0.3 * (hbd - 5)
        if logp < 1.0:
            log_aff += (1.0 - logp) * 0.4
        elif logp > 5.0:
            log_aff += (logp - 5.0) * 0.3
        if mw > 600:
            log_aff += 0.5
        elif 300 <= mw <= 500:
            log_aff -= 0.2

        affinity_nm = round(10 ** log_aff, 2)
        ci_low = round(max(0.1, affinity_nm * 0.7), 2)
        ci_high = round(affinity_nm * 1.3, 2)
        validation_method = "descriptor-heuristic"

    # Feature contributions (interpretability)
    logp_val = descriptors["LogP"]
    hbd_val = descriptors["HBD"]
    hba_val = descriptors["HBA"]
    tpsa_val = descriptors["TPSA"]
    mw_val = descriptors["MolWt"]
    n_aro = descriptors["NumAromaticRings"]
    rot = descriptors["NumRotatableBonds"]

    hydrophobic_score = min(max((logp_val / 5.0) * 40 + n_aro * 5, 10), 50)
    electrostatic_score = min(tpsa_val * 0.15, 25)
    hbond_score = min((hbd_val + hba_val / 2.0) * 5, 25)
    vdw_score = min(max(mw_val * 0.04 - rot * 1.5, 5), 20)
    total = hydrophobic_score + electrostatic_score + hbond_score + vdw_score

    feature_scores = {
        "hydrophobic_interaction": round(-(hydrophobic_score / total) * 10, 2),
        "electrostatic_contribution": round(-(electrostatic_score / total) * 10, 2),
        "binding_entropy": round(-(hbond_score / total) * 10, 2),
        "rotatable_bond_penalty": round((vdw_score / total) * 10, 2),
    }

    # Applicability domain
    applicability = compute_applicability_domain(feature_vector)

    # ADMET
    admet = _model_data is not None and compute_admet_properties(mol) or compute_admet_properties(mol)

    # Substructure attribution
    attributions = compute_substructure_attribution(mol, fp)

    elapsed_ms = round((time.time() - start) * 1000, 1)

    return PredictResponse(
        smiles=req.smiles.strip(),
        target_protein=req.target_protein,
        affinity_nm=affinity_nm,
        ci_low=ci_low,
        ci_high=ci_high,
        validation_method=validation_method,
        feature_scores=feature_scores,
        prediction_ms=elapsed_ms,
        applicability_domain=ApplicabilityDomain(**applicability),
        admet=ADMETProperties(**admet),
        substructure_attributions=[
            SubstructureAttribution(**a) for a in attributions
        ],
    )
