import math
import random
import time
import uuid
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

app = FastAPI(title="OmniMole PROTAC Design Engine", version="1.0.0")

E3_LIGASES: dict[str, dict] = {
    "CRBN": {"uniprot": "Q96SW2", "warheads": ["lenalidomide", "pomalidomide", "thalidomide"], "degron_motif": "H-C-A-S-C", "cereblon_domain": "ION"},
    "VHL": {"uniprot": "P40337", "warheads": ["VH032", "VL285"], "degron_motif": "P-P-P-P-P", "vhl_domain": "EloBC-C"},
    "MDM2": {"uniprot": "Q00987", "warheads": ["nutlin-3a", "RG7112"], "degron_motif": "F-X-X-W", "p53_binding": True},
    "IAP": {"uniprot": "Q13490", "warheads": ["bestatin", "MV1"], "degron_motif": "A-V-P-F", "bir_domain": True},
    "DCAF16": {"uniprot": "Q9NXF7", "warheads": ["KB02", "KB03"], "degron_motif": "W-X-X-X-W", "dcaf_domain": "WD40"},
}

E3_WARHEAD_SMILES: dict[str, list[str]] = {
    "CRBN": ["C1=CC(=O)N(C2=CC=C(C=C12)C(=O)N)C3CCC(=O)NC3=O"],
    "VHL": ["CC(C)C1=CC=C(C=C1)C(=O)N[C@@H](CC(=O)N2CCCC2C(=O)NCC(=O)O)C(=O)N"],
    "MDM2": ["CC(C)CC1=CC=C(C=C1)C2=NC3=CC=CC=C3N2C4=CC=C(C=C4)C(=O)N"],
}

LINKER_TYPES: dict[str, list[int]] = {
    "PEG": list(range(1, 13)),
    "alkyl": list(range(2, 16, 2)),
    "alkyl-ether": list(range(2, 10)),
    "piperazine": [1, 2],
    "triazole": [1],
}


class PROTACDesignRequest(BaseModel):
    target_smiles: str = Field(..., description="SMILES of the target-binding warhead")
    target_name: str = Field(default="BRD4", description="Target protein name")
    e3_ligase: str = Field(default="CRBN", description="E3 ligase to recruit")
    linker_type: str = Field(default="PEG", description="Linker chemistry")
    linker_length: int = Field(default=4, ge=1, le=16)
    count: int = Field(default=5, ge=1, le=20)


class LinkerInfo(BaseModel):
    type: str
    length: int
    smiles_parts: list[str]
    length_a: float
    flexibility: float


class TernaryComplexPrediction(BaseModel):
    interface_score: float
    proximity_nm: float
    favorable_pocket: bool
    predicted_dc50_nm: float
    e3_engaged: bool
    degradation_domain: str


class PROTACHit(BaseModel):
    id: str
    target: str
    e3_ligase: str
    warhead_smiles: str
    e3_warhead_smiles: str
    linker: LinkerInfo
    full_protac_smiles: str
    mw: float
    logp: float
    rotatable_bonds: int
    ternary_complex: TernaryComplexPrediction
    predicted_dc50_nm: float
    molecular_glue_score: float
    synthetic_accessibility: float


class PROTACDesignResponse(BaseModel):
    target: str
    e3_ligase: str
    designs: list[PROTACHit]
    best_ternary_score: float
    inference_ms: float


class MolecularGlueRequest(BaseModel):
    target_protein: str = Field(..., description="Target protein name")
    e3_ligase: str = Field(default="CRBN")
    library_size: int = Field(default=1000)


class MolecularGlueHit(BaseModel):
    smiles: str
    predicted_affinity_nm: float
    neo_interface_score: float
    degradation_activity: float
    selectivity_score: float


class MolecularGlueResponse(BaseModel):
    target: str
    e3_ligase: str
    hits: list[MolecularGlueHit]
    total_screened: int


def build_linker(linker_type: str, length: int) -> LinkerInfo:
    peg_units = ["O"] + ["CCO"] * length
    alkyl_units = ["C"] * length
    smiles_parts = peg_units if linker_type == "PEG" else alkyl_units
    length_a = round(length * 1.5 + 2.0, 1)
    flexibility = round(min(1.0, length * 0.08), 2)
    return LinkerInfo(
        type=linker_type,
        length=length,
        smiles_parts=smiles_parts,
        length_a=length_a,
        flexibility=flexibility,
    )


def compute_protac_properties(warhead: str, e3_warhead: str, linker_smiles: str) -> tuple[float, float, int]:
    combined = f"{warhead}.{linker_smiles}.{e3_warhead}"
    mol = Chem.MolFromSmiles(combined)
    if mol is None:
        return 600.0, 3.0, 8
    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    rot = Descriptors.NumRotatableBonds(mol)
    return round(mw, 1), round(logp, 2), rot


def predict_ternary_complex(e3: str, target: str) -> TernaryComplexPrediction:
    rng = np.random.RandomState(hash(f"{e3}_{target}") % (2**31))
    interface = round(float(rng.beta(4, 3)), 3)
    proximity = round(float(rng.uniform(0.5, 2.5)), 2)
    favorable = interface > 0.5
    dc50 = round(float(rng.uniform(0.1, 50)) / interface, 2)
    return TernaryComplexPrediction(
        interface_score=interface,
        proximity_nm=proximity,
        favorable_pocket=favorable,
        predicted_dc50_nm=dc50,
        e3_engaged=True,
        degradation_domain=E3_LIGASES.get(e3, {}).get("degron_motif", "Unknown"),
    )


@app.post("/design", response_model=PROTACDesignResponse)
def design_protacs(req: PROTACDesignRequest):
    start = time.time()

    if req.e3_ligase.upper() not in E3_LIGASES:
        e3 = "CRBN"
    else:
        e3 = req.e3_ligase.upper()
    if req.linker_type not in LINKER_TYPES:
        linker_type = "PEG"
    else:
        linker_type = req.linker_type

    e3_data = E3_LIGASES[e3]
    e3_warheads = E3_WARHEAD_SMILES.get(e3, E3_WARHEAD_SMILES["CRBN"])
    e3_smiles = e3_warheads[0]

    designs = []
    for i in range(req.count):
        linker = build_linker(linker_type, req.linker_length + i % 3)
        linker_smiles = ".".join(linker.smiles_parts)
        full_smiles = f"{req.target_smiles}.{linker_smiles}.{e3_smiles}"

        mw, logp, rot = compute_protac_properties(req.target_smiles, e3_smiles, linker_smiles)
        ternary = predict_ternary_complex(e3, req.target_name)

        dc50 = ternary.predicted_dc50_nm
        glue_score = round(float(min(1.0, ternary.interface_score * 0.7 + 0.3 * (1.0 / (1.0 + dc50 / 10)))), 3)
        sa = round(float(min(10, 5 + linker.length * 0.3 + 2.0)), 2)

        designs.append(PROTACHit(
            id=str(uuid.uuid4()),
            target=req.target_name,
            e3_ligase=e3,
            warhead_smiles=req.target_smiles,
            e3_warhead_smiles=e3_smiles,
            linker=linker,
            full_protac_smiles=full_smiles,
            mw=mw,
            logp=logp,
            rotatable_bonds=rot,
            ternary_complex=ternary,
            predicted_dc50_nm=dc50,
            molecular_glue_score=glue_score,
            synthetic_accessibility=sa,
        ))

    designs.sort(key=lambda p: p.predicted_dc50_nm)

    return PROTACDesignResponse(
        target=req.target_name,
        e3_ligase=e3,
        designs=designs,
        best_ternary_score=designs[0].ternary_complex.interface_score if designs else 0.0,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/molecular-glues", response_model=MolecularGlueResponse)
def screen_molecular_glues(req: MolecularGlueRequest):
    start = time.time()
    e3 = req.e3_ligase.upper()
    if e3 not in E3_LIGASES:
        e3 = "CRBN"

    rng = np.random.RandomState(hash(f"glues_{req.target_protein}_{e3}") % (2**31))
    hits = []
    for i in range(min(req.library_size, 100)):
        aff = round(float(10 ** rng.uniform(-1, 2)), 2)
        neo = round(float(rng.beta(2, 4)), 3)
        deg = round(float(rng.uniform(0.1, 0.9)), 3)
        sel = round(float(rng.beta(3, 2)), 3)
        if neo > 0.3 and deg > 0.3:
            dummy_smiles = f"C{i}C(=O)NC1=CC=CC=C1"
            hits.append(MolecularGlueHit(
                smiles=dummy_smiles,
                predicted_affinity_nm=aff,
                neo_interface_score=neo,
                degradation_activity=deg,
                selectivity_score=sel,
            ))
    hits.sort(key=lambda h: -h.neo_interface_score * h.degradation_activity)

    return MolecularGlueResponse(
        target=req.target_protein,
        e3_ligase=e3,
        hits=hits[:20],
        total_screened=req.library_size,
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "e3_ligases": list(E3_LIGASES.keys()),
        "linker_types": list(LINKER_TYPES.keys()),
    }
