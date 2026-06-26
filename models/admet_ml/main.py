import math
import time
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

app = FastAPI(title="OmniMole ADMET ML Suite", version="1.0.0")

MORGAN_BITS = 2048
MORGAN_RADIUS = 2


class ADMETRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string")
    detailed: bool = Field(default=True, description="Return full ADMET breakdown")


class ADMETProperty(BaseModel):
    name: str
    value: float
    classification: str
    confidence: float
    details: dict = {}


class MetabolicSite(BaseModel):
    atom_index: int
    probability: float
    cyp_enzyme: str
    reaction_type: str


class MetabolismPrediction(BaseModel):
    sites: list[MetabolicSite]
    primary_metabolizer: str
    half_life_hours: float
    clearance_ml_min_kg: float


class DDIPair(BaseModel):
    drug: str
    severity: str
    mechanism: str
    probability: float


class DDIProfile(BaseModel):
    interactions: list[DDIPair]
    cyp_inhibition: dict[str, str]
    cyp_induction: dict[str, str]
    transporter_interactions: dict[str, str]


class ToxicityPrediction(BaseModel):
    endpoint: str
    probability: float
    risk_level: str
    model_used: str


class ADMETResponse(BaseModel):
    smiles: str
    lipinski: dict
    physicochemical: dict
    absorption: dict
    distribution: dict
    metabolism: MetabolismPrediction
    toxicity: list[ToxicityPrediction]
    ddi: DDIProfile
    drug_likeness: dict
    admet_score: float
    inference_ms: float


def morgan_fingerprint(smiles: str) -> Optional[np.ndarray]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, MORGAN_RADIUS, nBits=MORGAN_BITS)
    arr = np.zeros((MORGAN_BITS,), dtype=np.float32)
    AllChem.DataStructs.ConvertToNumpyArray(fp, arr)
    return arr


def predict_logs(mw: float, logp: float, hbd: int, hba: int, rot: int) -> float:
    return -0.5 + 0.3 * logp - 0.01 * mw + 0.02 * hbd - 0.01 * hba - 0.02 * rot


def predict_fa30(mw: float, logp: float, tpsa: float, hbd: int) -> float:
    return min(100, max(0, 50 + 5 * logp - 0.02 * mw - 0.1 * tpsa - 3 * hbd))


def predict_vdss(logp: float, tpsa: float, hbd: int, charge: float = 0.0) -> float:
    return max(0.1, 0.5 + 0.2 * logp - 0.005 * tpsa - 0.05 * hbd + 0.1 * charge)


def predict_bbb(logp: float, tpsa: float, mw: float) -> tuple[bool, float]:
    score = -0.1 + 0.3 * logp - 0.01 * tpsa - 0.002 * mw
    penetrant = score > -0.5
    return penetrant, round(score, 3)


def predict_ppb(logp: float, tpsa: float, hbd: int, logd: float = None) -> float:
    if logd is None:
        logd = logp - 0.5
    return min(99.9, max(0, 70 + 5 * logd - 0.1 * tpsa - 2 * hbd))


def predict_herg(logp: float, mw: float, hbd: int, n_aromatic: int) -> tuple[str, float, float]:
    pIC50 = -4.5 + 0.6 * logp + 0.008 * mw + 0.3 * n_aromatic - 0.1 * hbd
    probability = 1.0 / (1.0 + math.exp(-pIC50))
    risk = "high" if probability > 0.7 else "medium" if probability > 0.4 else "low"
    ic50 = round(10 ** (-pIC50) * 1e6, 1)
    return risk, round(probability, 3), ic50


def predict_ames(smiles: str, mol) -> tuple[float, str]:
    alert_count = 0
    alerts = []
    aromatic_nitro = mol.HasSubstructMatch(Chem.MolFromSmarts("[N+](=O)[O-]"))
    aromatic_amine = mol.HasSubstructMatch(Chem.MolFromSmarts("cN"))
    azo = mol.HasSubstructMatch(Chem.MolFromSmarts("N=N"))
    epoxide = mol.HasSubstructMatch(Chem.MolFromSmarts("C1CO1"))

    if aromatic_nitro:
        alert_count += 2
        alerts.append("aromatic_nitro")
    if aromatic_amine:
        alert_count += 1
        alerts.append("aromatic_amine")
    if azo:
        alert_count += 2
        alerts.append("azo_group")
    if epoxide:
        alert_count += 2
        alerts.append("epoxide")

    prob = 1.0 / (1.0 + math.exp(-(-2.0 + 0.5 * alert_count)))
    risk = "high" if prob > 0.7 else "medium" if prob > 0.4 else "low"
    return round(prob, 3), risk


def predict_hepatotoxicity(logp: float, mw: float, hbd: int, logd: float = None) -> tuple[float, str]:
    if logd is None:
        logd = logp - 0.5
    score = -2.0 + 0.4 * logp + 0.003 * mw + 0.2 * hbd + 0.5 * max(0, logd - 3)
    prob = 1.0 / (1.0 + math.exp(-score))
    risk = "high" if prob > 0.6 else "medium" if prob > 0.3 else "low"
    return round(prob, 3), risk


def predict_cyp_inhibition(mol, smiles: str) -> dict[str, str]:
    cyp_patterns = {
        "CYP3A4": ["C(=O)NC", "CN1CCN(CC1)", "c1ccncc1"],
        "CYP2D6": ["c1cccc2c1CCCC2", "CC(N)C"],
        "CYP2C9": ["c1ccc2c(c1)cccc2", "C(=O)O"],
        "CYP1A2": ["c1ccc2ccccc2c1", "c1cnc2ccccc2c1"],
        "CYP2C19": ["c1ccc2c(c1)nnn2", "C1CCCC1"],
    }
    inhibitions = {}
    for enzyme, patterns in cyp_patterns.items():
        inhibited = False
        for pat in patterns:
            try:
                if mol.HasSubstructMatch(Chem.MolFromSmarts(pat)):
                    inhibited = True
                    break
            except Exception:
                pass
        inhibitions[enzyme] = "inhibitor" if inhibited else "non-inhibitor"
    return inhibitions


def predict_cyp_induction(smiles: str) -> dict[str, str]:
    return {
        "CYP3A4": "non-inducer" if "C(=O)NC" not in smiles else "inducer",
        "CYP1A2": "non-inducer",
        "CYP2B6": "non-inducer",
    }


def predict_transporter_interactions(mol) -> dict[str, str]:
    return {
        "P-glycoprotein": "substrate" if mol and Descriptors.MolWt(mol) > 400 else "non-substrate",
        "OATP1B1": "substrate" if mol and Descriptors.MolLogP(mol) > 3 else "non-substrate",
        "OATP1B3": "non-substrate",
        "BCRP": "substrate" if mol and Descriptors.TPSA(mol) > 100 else "non-substrate",
    }


def predict_metabolism_sites(mol, smiles: str) -> tuple[list[dict], str]:
    sites = []
    for atom in mol.GetAtoms():
        idx = atom.GetAtomIdx()
        atomic_num = atom.GetAtomicNum()
        degree = atom.GetDegree()
        hybridization = atom.GetHybridization()

        prob = 0.0
        enzyme = ""
        reaction = ""

        if atomic_num == 6 and hybridization == 2:
            prob = 0.3
            enzyme = "CYP3A4"
            reaction = "aliphatic_hydroxylation"
        elif atomic_num == 6 and atom.GetIsAromatic():
            prob = 0.4
            enzyme = "CYP1A2"
            reaction = "aromatic_hydroxylation"
        elif atomic_num == 7 and not atom.GetIsAromatic():
            prob = 0.5
            enzyme = "CYP3A4"
            reaction = "N_dealkylation"
        elif atomic_num == 8 and hybridization == 2:
            prob = 0.3
            enzyme = "CYP2D6"
            reaction = "O_dealkylation"
        elif atomic_num == 16:
            prob = 0.4
            enzyme = "CYP3A4"
            reaction = "S_oxidation"
        elif atomic_num == 9:
            prob = 0.2
            enzyme = "CYP2C9"
            reaction = "defluorination"

        if prob > 0.15:
            sites.append(MetabolicSite(
                atom_index=idx,
                probability=round(prob, 3),
                cyp_enzyme=enzyme,
                reaction_type=reaction,
            ))

    sites.sort(key=lambda x: -x.probability)
    top_enzymes = [s.cyp_enzyme for s in sites[:3]]
    primary = top_enzymes[0] if top_enzymes else "CYP3A4"

    return sites[:15], primary


def compute_admet_score(props: dict) -> float:
    score = 0.0
    if props.get("lipinski_pass"):
        score += 0.2
    if props.get("bbb_penetrant") is False:
        score += 0.1
    if props.get("herg_risk") == "low":
        score += 0.15
    elif props.get("herg_risk") == "medium":
        score += 0.05
    if props.get("ames_risk") == "low":
        score += 0.15
    elif props.get("ames_risk") == "medium":
        score += 0.05
    if props.get("hepatotox_risk") == "low":
        score += 0.15
    elif props.get("hepatotox_risk") == "medium":
        score += 0.05
    if props.get("solubility_class") in ("high", "moderate"):
        score += 0.1
    if props.get("fa30", 0) > 30:
        score += 0.05
    if props.get("cyp_inhibition_count", 5) <= 2:
        score += 0.1

    return round(min(1.0, score), 3)


@app.post("/predict", response_model=ADMETResponse)
def predict_admet(req: ADMETRequest):
    start = time.time()
    mol = Chem.MolFromSmiles(req.smiles)
    if mol is None:
        raise HTTPException(400, "Invalid SMILES")

    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    tpsa = Descriptors.TPSA(mol)
    rot = Descriptors.NumRotatableBonds(mol)
    n_aro = Descriptors.NumAromaticRings(mol)
    n_rings = Descriptors.RingCount(mol)
    n_het = Descriptors.NumHeteroatoms(mol)
    frac_csp3 = Descriptors.FractionCSP3(mol)
    qed = Descriptors.qed(mol)
    charge = Chem.GetFormalCharge(mol)

    lipinski_violations = 0
    if mw > 500:
        lipinski_violations += 1
    if logp > 5:
        lipinski_violations += 1
    if hbd > 5:
        lipinski_violations += 1
    if hba > 10:
        lipinski_violations += 1

    logd = logp - 0.5 * (1.0 - frac_csp3)

    logs = predict_logs(mw, logp, hbd, hba, rot)
    fa30 = predict_fa30(mw, logp, tpsa, hbd)
    vdss = predict_vdss(logp, tpsa, hbd, charge)
    bbb_penetrant, bbb_score = predict_bbb(logp, tpsa, mw)
    ppb = predict_ppb(logp, tpsa, hbd, logd)

    herg_risk, herg_prob, herg_ic50 = predict_herg(logp, mw, hbd, n_aro)
    ames_prob, ames_risk = predict_ames(req.smiles, mol)
    hepato_prob, hepato_risk = predict_hepatotoxicity(logp, mw, hbd, logd)

    cyp_inhibition = predict_cyp_inhibition(mol, req.smiles)
    cyp_induction = predict_cyp_induction(req.smiles)
    transporter = predict_transporter_interactions(mol)

    n_cyp_inhibitors = sum(1 for v in cyp_inhibition.values() if v == "inhibitor")

    metabolism_sites, primary_metabolizer = predict_metabolism_sites(mol, req.smiles)

    predicted_half_life = round(max(0.5, min(48, 4.0 - 0.3 * logp + 0.01 * mw - 0.5 * hbd + 1.0)), 1)
    predicted_clearance = round(max(0.1, min(150, 20 + 5 * logp - 0.5 * hbd + 2 * n_aro)), 1)

    ddi_interactions = []
    for enzyme, status in cyp_inhibition.items():
        if status == "inhibitor":
            ddi_interactions.append(DDIPair(
                drug=f"{enzyme} substrate",
                severity="moderate",
                mechanism=f"{enzyme} inhibition",
                probability=round(0.4 + 0.1 * (n_cyp_inhibitors > 2), 2)
            ))

    toxicity_endpoints = [
        ToxicityPrediction(endpoint="AMES Mutagenicity", probability=ames_prob, risk_level=ames_risk, model_used="structural-alerts"),
        ToxicityPrediction(endpoint="hERG Cardiotoxicity", probability=herg_prob, risk_level=herg_risk, model_used="logistic-regression"),
        ToxicityPrediction(endpoint="Hepatotoxicity", probability=hepato_prob, risk_level=hepato_risk, model_used="logistic-regression"),
    ]

    if n_aro > 3:
        toxicity_endpoints.append(ToxicityPrediction(endpoint="Carcinogenicity", probability=round(0.3 + 0.1 * (n_aro - 3), 3), risk_level="medium", model_used="structural-alerts"))
    if bbb_penetrant:
        toxicity_endpoints.append(ToxicityPrediction(endpoint="CNS Toxicity", probability=round(0.2 + 0.05 * logp, 3), risk_level="low" if logp < 3 else "medium", model_used="rule-based"))

    solubility_class = "high" if logs > -2 else "moderate" if logs > -4 else "low"
    lipinski_pass = lipinski_violations <= 1

    props = {
        "lipinski_pass": lipinski_pass,
        "bbb_penetrant": bbb_penetrant,
        "herg_risk": herg_risk,
        "ames_risk": ames_risk,
        "hepatotox_risk": hepato_risk,
        "solubility_class": solubility_class,
        "fa30": fa30,
        "cyp_inhibition_count": n_cyp_inhibitors,
    }
    admet_score = compute_admet_score(props)

    response = ADMETResponse(
        smiles=req.smiles,
        lipinski={
            "violations": lipinski_violations,
            "pass": lipinski_pass,
            "mw": round(mw, 2),
            "logp": round(logp, 2),
            "hbd": hbd,
            "hba": hba,
        },
        physicochemical={
            "tpsa": round(tpsa, 2),
            "rotatable_bonds": rot,
            "aromatic_rings": n_aro,
            "total_rings": n_rings,
            "heteroatoms": n_het,
            "frac_csp3": round(frac_csp3, 3),
            "qed": round(qed, 3),
            "formal_charge": charge,
        },
        absorption={
            "solubility_log_s": round(logs, 3),
            "solubility_class": solubility_class,
            "fa30_percent": round(fa30, 1),
            "caco2_permeability": round(-2.0 + 0.3 * logp - 0.01 * tpsa, 3),
            "bioavailability_score": round(0.55 + 0.05 * (lipinski_violations == 0) - 0.1 * (lipinski_violations > 2), 3),
        },
        distribution={
            "vdss_l_per_kg": round(vdss, 2),
            "bbb_penetrant": bbb_penetrant,
            "bbb_score": round(bbb_score, 3),
            "ppb_percent": round(ppb, 1),
            "fup_percent": round(max(0.1, min(50, 30 - 2 * logp + 0.02 * tpsa)), 2),
        },
        metabolism=MetabolismPrediction(
            sites=metabolism_sites,
            primary_metabolizer=primary_metabolizer,
            half_life_hours=predicted_half_life,
            clearance_ml_min_kg=predicted_clearance,
        ),
        toxicity=toxicity_endpoints,
        ddi=DDIProfile(
            interactions=ddi_interactions,
            cyp_inhibition=cyp_inhibition,
            cyp_induction=cyp_induction,
            transporter_interactions=transporter,
        ),
        drug_likeness={
            "qed": round(qed, 3),
            "lipinski_pass": lipinski_pass,
            "veber_pass": rot <= 10 and tpsa <= 140,
            "ghose_pass": 160 < mw < 480 and -0.4 < logp < 5.6 and 20 < tpsa < 130,
            "muegge_pass": 200 < mw < 600 and logp < 5 and hbd <= 5 and hba <= 10 and tpsa < 150,
            "beyond_rule_of_five": mw > 500 or logp > 5,
        },
        admet_score=admet_score,
        inference_ms=round((time.time() - start) * 1000, 1),
    )

    return response


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0", "models": ["admet-ml", "metabolism", "ddi", "toxicity"]}
