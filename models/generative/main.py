import copy
import math
import random
import uuid
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
from rdkit.Chem.rdchem import Mol

RDLogger.logger().setLevel(RDLogger.ERROR)

app = FastAPI(title="MoleCraft Molecule Generator", version="3.0.0")

AFFINITY_API_URL = "http://localhost:8001"

try:
    from vae_model import load_vae, build_vocab, generate_from_vae, TORCH_AVAILABLE as VAE_AVAILABLE
    _vae_model = load_vae()
    _vae_vocab = build_vocab() if _vae_model is not None else None
except Exception:
    _vae_model = None
    _vae_vocab = None
    VAE_AVAILABLE = False

TARGET_LIBRARIES: dict[str, list[dict]] = {
    "cox": [
        {"name": "Celecoxib", "smiles": "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F"},
        {"name": "Valdecoxib", "smiles": "CC1=C(C(=NO1)C2=CC=CC=C2)C3=CC=C(C=C3)S(=O)(=O)N"},
        {"name": "Rofecoxib", "smiles": "CS(=O)(=O)C1=CC=C(C=C1)C2=C(C(=O)OC2)C3=CC=C(C=C3)"},
        {"name": "Etoricoxib", "smiles": "CC1=CN=C(C=C1)C2=C(C=C(C=C2)S(=O)(=O)C)C3=CC=C(C=C3)Cl"},
        {"name": "Lumiracoxib", "smiles": "CC1=CC=CC(=C1CC2=CC(=C(C=C2)Cl)C(=O)O)Cl"},
        {"name": "Parecoxib", "smiles": "CC1=C(C(=NO1)C2=CC=CC=C2)C3=CC=C(C=C3)S(=O)(=O)NC(=O)C"},
    ],
    "egfr": [
        {"name": "Osimertinib", "smiles": "CN1CCN(CC1)C2=CC(=C(C=C2)NC3=NC=CC(=N3)C4=CN(C5=CC=CC=C45)C)NC(=O)C=C"},
        {"name": "Gefitinib", "smiles": "COC1=C(C=C2C(=C1)N=CN=C2NC3=CC(=C(C=C3)F)Cl)OCCCN4CCOCC4"},
        {"name": "Erlotinib", "smiles": "COCCOC1=C(C=C2C(=C1)N=CN=C2NC3=CC=CC(=C3)C#C)OCCOC"},
        {"name": "Afatinib", "smiles": "C=CC(=O)Nc1cc2c(Nc3ccc(F)c(Cl)c3)ncnc2cc1OC4CCN(C)CC4"},
        {"name": "Lapatinib", "smiles": "CS(=O)(=O)CCNCC1=CC=CO1c2ccc(F)cc2C(=O)Nc3cc4c(cc3Cl)NC(=O)CC4"},
    ],
    "jak": [
        {"name": "Tofacitinib", "smiles": "CC1N(CC2C1N(C3=C2C=NC4=C3C=CN4)C)C(=O)CC#N"},
        {"name": "Ruxolitinib", "smiles": "C1CC1CC(C2=CC=NN2)C3=C4C=CNC4=NC=N3"},
        {"name": "Baricitinib", "smiles": "CCS(=O)(=O)N1CC(C1)(CC#N)C2=C3C=CNC3=NC=N2"},
        {"name": "Upadacitinib", "smiles": "CC1=CNC2=NC=NN12C(=O)C3CCN(CC3)CC4=CC=C(C=C4)F"},
        {"name": "Filgotinib", "smiles": "CS(=O)(=O)N1CC(C1)(CC#N)C2=C3C=CNC3=NC=N2"},
    ],
    "braf": [
        {"name": "Vemurafenib", "smiles": "CCS(=O)(=O)C1=CC=C(C=C1)C2=NC3=C(C=C2)N=CN3C4=CC=C(C=C4)F"},
        {"name": "Dabrafenib", "smiles": "C1CC1c2ccc(Nc3ncnc4cc5cc(C(F)(F)F)ccc5c34)cc2S(=O)(=O)N"},
        {"name": "Encorafenib", "smiles": "CNS(=O)(=O)c1ccc(Nc2ncnc3cc4cc(C)ccc4c23)cc1C(F)(F)F"},
    ],
    "ace2": [
        {"name": "MLN-4760", "smiles": "OC(=O)C1CC(N(C1)C(=O)C2CC2)C(=O)NCC3=CC(=CC=C3)Cl"},
    ],
}

BIOISOSTERIC_REPLACEMENTS: list[tuple[str, str]] = [
    ("c1ccccc1", "c1ccncc1"), ("c1ccccc1", "c1ccsc1"),
    ("c1ccccc1", "c1cocc1"), ("c1ccccc1", "c1cccs1"),
    ("c1ccccc1", "c1ncccc1"), ("C(=O)O", "C(=O)N"),
    ("C(=O)O", "C(=O)NC"), ("C(=O)N", "S(=O)(=O)N"),
    ("C1CC1", "C1CCC1"), ("C1CC1", "C1CCCC1"),
    ("OH", "NH2"), ("NH2", "OH"),
    ("F", "Cl"), ("Cl", "F"),
    ("C", "N"), ("N", "C"),
]

FRAGMENT_LIBRARY: list[str] = [
    "c1ccccc1C(=O)O", "c1ccncc1", "c1ccsc1", "CC(=O)O",
    "CS(=O)(=O)N", "CN1CCN(CC1)", "C1CCC1", "c1ccccc1F",
    "c1cccnc1", "c1ccc2ccccc2c1", "C#N", "C=C",
    "OCCOC", "C1CCCC1", "CN(C)C", "S(=O)(=O)N",
    "C1COCCN1", "c1ccc(F)cc1", "CC(C)(C)", "CF",
    "CCN(C)CC", "C1CNCCN1", "c1ccco1", "c1cccs1",
]

random.seed(42)


def match_target_keywords(query: str) -> Optional[str]:
    q = query.lower()
    keywords = {
        "cox": ["cox", "cyclooxygenase", "prostaglandin", "inflammation", "nsaid"],
        "egfr": ["egfr", "epidermal growth factor", "erbb", "tyrosine kinase", "erlotinib"],
        "jak": ["jak", "janus kinase", "tofacitinib", "ruxolitinib", "baricitinib"],
        "braf": ["braf", "b-raf", "vemurafenib", "dabrafenib", "melanoma"],
        "ace2": ["ace2", "angiotensin", "sars", "covid", "renin"],
    }
    for key, terms in keywords.items():
        if any(t in q for t in terms):
            return key
    return None


def generate_vae_molecules(count: int) -> list[str]:
    if _vae_model is None or _vae_vocab is None:
        return []
    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        return generate_from_vae(_vae_model, _vae_vocab, n=count,
                                 temperature=0.95, device=device)
    except Exception as e:
        print(f"[VAE] Generation error: {e}")
        return []


def enumerate_variants(mol: Mol, smiles: str) -> list[dict]:
    variants_dict: dict[str, str] = {}

    try:
        for _ in range(30):
            random_smiles = Chem.MolToSmiles(mol, doRandom=True, canonical=False)
            rm = Chem.MolFromSmiles(random_smiles)
            if rm is not None:
                cs = Chem.MolToSmiles(rm)
                if cs != smiles:
                    variants_dict[cs] = f"Variant-{len(variants_dict) + 1}"
    except Exception:
        pass

    for pattern, replacement in BIOISOSTERIC_REPLACEMENTS[:8]:
        try:
            new_smiles = smiles.replace(pattern, replacement, 1)
            if new_smiles != smiles:
                rm = Chem.MolFromSmiles(new_smiles)
                if rm is not None:
                    cs = Chem.MolToSmiles(rm)
                    if cs != smiles:
                        variants_dict[cs] = f"Bioisostere-{len(variants_dict) + 1}"
        except Exception:
            pass

    try:
        from rdkit.Chem import BRICS
        fragments = list(BRICS.BRICSDecompose(mol))
        if len(fragments) >= 2:
            for i in range(min(20, len(FRAGMENT_LIBRARY) - 1)):
                combined = Chem.MolFromSmiles(f"{fragments[i % len(fragments)]}.{FRAGMENT_LIBRARY[i]}")
                if combined is not None:
                    cs = Chem.MolToSmiles(combined)
                    if cs != smiles and cs not in variants_dict:
                        variants_dict[cs] = f"Hybrid-{len(variants_dict) + 1}"
    except Exception:
        pass

    result = []
    for smi, name in variants_dict.items():
        m = Chem.MolFromSmiles(smi)
        if m is not None:
            try:
                result.append({
                    "smiles": smi, "name": name,
                    "mol_weight": round(Descriptors.MolWt(m), 2),
                    "log_p": round(Descriptors.MolLogP(m), 2),
                })
            except Exception:
                pass
    return result


class GenerateRequest(BaseModel):
    query: str = Field(..., description="Target protein or disease name")
    count: int = Field(default=6, ge=2, le=20, description="Number of molecules to generate")
    min_weight: float = Field(default=150, ge=50, description="Minimum molecular weight")
    max_weight: float = Field(default=600, ge=200, description="Maximum molecular weight")
    depth: str = Field(default="normal", pattern="^(normal|deep|ultra)$")


class RetrosynthesisRoute(BaseModel):
    route_id: str
    description: str
    precursors: list[str]
    reaction_type: str
    complexity_score: float


class MoleculeResult(BaseModel):
    id: str
    smiles: str
    name: str
    formula: str
    affinity_nm: float
    ci_low: float
    ci_high: float
    validation_method: str
    mol_weight: float
    log_p: float
    hb_donors: int
    hb_acceptors: int
    qed: float
    sa_score: float
    retrosynthesis_routes: list[RetrosynthesisRoute] = []


class GenerateResponse(BaseModel):
    query: str
    molecules: list[MoleculeResult]


def compute_sa_score(mol: Mol) -> float:
    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    rot = Descriptors.NumRotatableBonds(mol)
    n_aromatic = Descriptors.NumAromaticRings(mol)
    ring_count = Descriptors.RingCount(mol)
    n_atoms = mol.GetNumAtoms()
    n_hetero = Descriptors.NumHeteroatoms(mol)
    chiral_centers = len(Chem.FindMolChiralCenters(mol, includeUnassigned=True))

    complexity = 0.0
    complexity += min(mw / 100.0, 10.0)
    complexity += ring_count * 1.5
    complexity += n_hetero * 0.5
    complexity += chiral_centers * 1.0
    complexity += abs(logp - 2.5) * 0.3
    complexity += max(0, rot - 5) * 0.5
    complexity += n_aromatic * 0.8
    complexity += max(0, hbd - 2) * 0.4
    complexity += max(0, hba - 4) * 0.3

    normalized = min(complexity / 12.0, 1.0)
    sa = 1.0 + normalized * 9.0
    return round(sa, 2)


def plan_retrosynthesis(mol: Mol) -> list[dict]:
    routes = []
    try:
        from rdkit.Chem import BRICS
        fragments = list(BRICS.BRICSDecompose(mol))
        if len(fragments) >= 2:
            unique_frags = list(set(fragments))
            routes.append({
                "route_id": "brics-1",
                "description": f"BRICS disconnection into {len(unique_frags)} building blocks",
                "precursors": unique_frags[:5],
                "reaction_type": "BRICS retrosynthetic disconnection",
                "complexity_score": round(len(unique_frags) * 0.5, 2),
            })
    except Exception:
        pass

    try:
        from rdkit.Chem import Recap
        recap = Recap.RecapDecompose(mol)
        if recap and hasattr(recap, "GetLeaves"):
            leaves = list(recap.GetLeaves().values())
            if leaves:
                leaf_smiles = [Chem.MolToSmiles(l.mol) for l in leaves[:5] if hasattr(l, "mol")]
                routes.append({
                    "route_id": "recap-1",
                    "description": f"RECAP decomposition into {len(leaf_smiles)} synthons",
                    "precursors": leaf_smiles,
                    "reaction_type": "RECAP retrosynthetic analysis",
                    "complexity_score": round(len(leaf_smiles) * 0.6, 2),
                })
    except Exception:
        pass

    return routes


def compute_properties(smiles: str) -> Optional[dict]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    try:
        formula = Chem.rdMolDescriptors.CalcMolFormula(mol)
    except Exception:
        formula = ""
    try:
        qed = Chem.Descriptors.qed(mol)
    except Exception:
        qed = 0.5
    sa = compute_sa_score(mol)
    retrosynthesis = plan_retrosynthesis(mol)
    return {
        "formula": formula,
        "mol_weight": round(Descriptors.MolWt(mol), 2),
        "log_p": round(Descriptors.MolLogP(mol), 2),
        "hb_donors": Descriptors.NumHDonors(mol),
        "hb_acceptors": Descriptors.NumHAcceptors(mol),
        "qed": round(qed, 3),
        "sa_score": sa,
        "retrosynthesis_routes": retrosynthesis,
    }


def predict_affinity(smiles: str, target: str) -> Optional[dict]:
    try:
        resp = requests.post(
            f"{AFFINITY_API_URL}/predict",
            json={"smiles": smiles, "target_protein": target},
            timeout=5,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def generate_for_known_target(target_key: str, count: int, min_mw: float, max_mw: float) -> list[dict]:
    library = TARGET_LIBRARIES.get(target_key, [])
    if not library:
        return []

    molecules = []
    seen_smiles: set[str] = set()

    for entry in library[:count]:
        mol = Chem.MolFromSmiles(entry["smiles"])
        if mol is None:
            continue
        props = compute_properties(entry["smiles"])
        if props is None:
            continue
        if props["mol_weight"] < min_mw or props["mol_weight"] > max_mw:
            continue
        molecules.append({
            "smiles": entry["smiles"], "name": entry["name"], **props,
        })
        seen_smiles.add(entry["smiles"])

    if len(molecules) < count:
        base_smiles = library[0]["smiles"]
        base_mol = Chem.MolFromSmiles(base_smiles)
        if base_mol:
            variants = enumerate_variants(base_mol, base_smiles)
            random.shuffle(variants)
            for variant in variants:
                if len(molecules) >= count:
                    break
                smi = variant["smiles"]
                if smi in seen_smiles:
                    continue
                props = compute_properties(smi)
                if props is None:
                    continue
                if props["mol_weight"] < min_mw or props["mol_weight"] > max_mw:
                    continue
                molecules.append({
                    "smiles": smi, "name": variant["name"], **props,
                })
                seen_smiles.add(smi)

    return molecules


def generate_fallback(query: str, count: int, min_mw: float, max_mw: float) -> list[dict]:
    molecules = []
    seen_smiles: set[str] = set()

    # Try VAE generation first
    vae_smiles = generate_vae_molecules(count * 2)
    for smi in vae_smiles:
        if len(molecules) >= count:
            break
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            continue
        try:
            cs = Chem.MolToSmiles(mol)
        except Exception:
            continue
        if cs in seen_smiles:
            continue
        props = compute_properties(cs)
        if props is None:
            continue
        if props["mol_weight"] < min_mw or props["mol_weight"] > max_mw:
            continue
        if props["qed"] < 0.3:
            continue
        molecules.append({
            "smiles": cs,
            "name": f"VAE-{query[:3].upper()}-{100 + len(molecules)}",
            **props,
        })
        seen_smiles.add(cs)

    # Fall back to fragment assembly if VAE didn't produce enough
    for i in range(count * 10):
        if len(molecules) >= count:
            break
        frag1 = random.choice(FRAGMENT_LIBRARY)
        frag2 = random.choice(FRAGMENT_LIBRARY)
        connector = random.choice(["", "C", "CC", "N", "O"])
        combined_smiles = f"{frag1}.{connector}.{frag2}" if connector else f"{frag1}.{frag2}"
        combined = Chem.MolFromSmiles(combined_smiles)
        if combined is not None:
            try:
                cs = Chem.MolToSmiles(Chem.MolFromSmiles(Chem.MolToSmiles(combined)))
            except Exception:
                continue
            if cs in seen_smiles:
                continue
            props = compute_properties(cs)
            if props is None:
                continue
            if props["mol_weight"] < min_mw or props["mol_weight"] > max_mw:
                continue
            if props["qed"] < 0.3:
                continue
            molecules.append({
                "smiles": cs,
                "name": f"MoleCraft-{query[:3].upper()}-{100 + len(molecules)}",
                **props,
            })
            seen_smiles.add(cs)

    return molecules


@app.post("/generate")
def generate(req: GenerateRequest):
    import time
    start = time.time()

    target_key = match_target_keywords(req.query)

    if target_key:
        molecules = generate_for_known_target(target_key, req.count, req.min_weight, req.max_weight)
    else:
        molecules = []

    if len(molecules) < req.count:
        fallback = generate_fallback(req.query, req.count - len(molecules), req.min_weight, req.max_weight)
        molecules.extend(fallback)

    random.shuffle(molecules)
    molecules = molecules[:req.count]

    result_molecules = []
    for mol_data in molecules:
        smiles = mol_data["smiles"]
        affinity_result = predict_affinity(smiles, req.query)
        if affinity_result:
            affinity_nm = affinity_result["affinity_nm"]
            ci_low = affinity_result["ci_low"]
            ci_high = affinity_result["ci_high"]
            validation_method = affinity_result["validation_method"]
        else:
            logp = mol_data["log_p"]
            mw = mol_data["mol_weight"]
            hbd = mol_data["hb_donors"]
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

        retrosynthesis = mol_data.get("retrosynthesis_routes", [])
        retro_models = [
            RetrosynthesisRoute(
                route_id=r["route_id"],
                description=r["description"],
                precursors=r["precursors"],
                reaction_type=r["reaction_type"],
                complexity_score=r["complexity_score"],
            ) for r in retrosynthesis
        ]

        result_molecules.append(MoleculeResult(
            id=str(uuid.uuid4()),
            smiles=smiles,
            name=mol_data.get("name", "Unknown"),
            formula=mol_data["formula"],
            affinity_nm=affinity_nm,
            ci_low=ci_low,
            ci_high=ci_high,
            validation_method=validation_method,
            mol_weight=mol_data["mol_weight"],
            log_p=mol_data["log_p"],
            hb_donors=mol_data["hb_donors"],
            hb_acceptors=mol_data["hb_acceptors"],
            qed=mol_data["qed"],
            sa_score=mol_data["sa_score"],
            retrosynthesis_routes=retro_models,
        ))

    return GenerateResponse(query=req.query, molecules=result_molecules)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "vae_loaded": _vae_model is not None,
    }
