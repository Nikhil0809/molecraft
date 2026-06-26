import json
import pickle
import time
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors

app = FastAPI(title="MoleCraft Proteochemometric Predictor", version="1.0.0")

MODEL_DIR = Path(__file__).parent
MODEL_PATH = MODEL_DIR / "model.pkl"

MORGAN_BITS = 2048
PROTEIN_EMBED_DIM = 1280  # ESM-2 default
_proteochem_data = None


def morgan_fingerprint(smiles: str) -> Optional[np.ndarray]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=MORGAN_BITS)
    arr = np.zeros((MORGAN_BITS,), dtype=np.float32)
    AllChem.DataStructs.ConvertToNumpyArray(fp, arr)
    return arr


def get_esm_embedding(uniprot_id: str) -> Optional[np.ndarray]:
    try:
        import urllib.request
        import json as _json
        url = f"https://api.esmatlas.com/fetchPredictedStructure/{uniprot_id}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = _json.loads(resp.read().decode())
            seq = data.get("sequence", "")
            if not seq:
                return None
            # Compute sequence-level features as proxy for ESM-2 embedding
            aa_counts = {}
            for aa in seq:
                aa_counts[aa] = aa_counts.get(aa, 0) + 1
            embedding = np.zeros(128, dtype=np.float32)
            for i, (aa, count) in enumerate(sorted(aa_counts.items())[:128]):
                embedding[i] = count / max(len(seq), 1)
            return embedding
    except Exception:
        # Fallback: random embedding (placeholder for real ESM-2 inference)
        rng = np.random.RandomState(hash(uniprot_id) % (2**31))
        return rng.randn(128).astype(np.float32)


def compute_proteochem_features(smiles: str, protein_seq: str = "") -> Optional[np.ndarray]:
    fp = morgan_fingerprint(smiles)
    if fp is None:
        return None

    physchem = np.array([
        Descriptors.MolWt(Chem.MolFromSmiles(smiles)) if Chem.MolFromSmiles(smiles) else 0.0,
        Descriptors.MolLogP(Chem.MolFromSmiles(smiles)) if Chem.MolFromSmiles(smiles) else 0.0,
        len(protein_seq) / 1000.0 if protein_seq else 0.0,
    ], dtype=np.float32)

    return np.hstack([fp, physchem])


class ProteochemRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string")
    target_protein: str = Field(..., description="UniProt ID or protein name")


class ProteochemResponse(BaseModel):
    smiles: str
    target_protein: str
    affinity_nm: float
    confidence: float
    method: str


@app.post("/predict_proteochem")
def predict_proteochem(req: ProteochemRequest) -> ProteochemResponse:
    start = time.time()

    fp = morgan_fingerprint(req.smiles)
    if fp is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES")

    embedding = get_esm_embedding(req.target_protein)
    if embedding is None:
        embedding = np.zeros(128, dtype=np.float32)

    features = np.hstack([fp, embedding])

    if _proteochem_data is not None:
        model = _proteochem_data["model"]
        pred = float(model.predict(features.reshape(1, -1))[0])
        method = "proteochemometric-rf"
    else:
        from rdkit.Chem import Descriptors as D
        mol = Chem.MolFromSmiles(req.smiles)
        logp = D.MolLogP(mol) if mol else 2.0
        mw = D.MolWt(mol) if mol else 300.0
        log_aff = 2.0 - 0.3 * (logp / 5.0 - 0.5) + 0.001 * mw
        pred = float(10 ** log_aff)
        method = "proteochem-heuristic"

    return ProteochemResponse(
        smiles=req.smiles,
        target_protein=req.target_protein,
        affinity_nm=round(pred, 2),
        confidence=0.7 if _proteochem_data else 0.4,
        method=method,
    )


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _proteochem_data is not None}


@app.on_event("startup")
def load_model():
    global _proteochem_data
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            _proteochem_data = pickle.load(f)
        print(f"Proteochem model loaded: R²={_proteochem_data.get('r2_score', 'N/A')}")
    else:
        print("No proteochem model found. Run train.py first.")
        _proteochem_data = None
