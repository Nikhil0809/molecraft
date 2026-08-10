import random
import time
import uuid

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="OmniMole Peptide & Macrocycle Design", version="1.0.0")

NATURAL_AA = list("ACDEFGHIKLMNPQRSTVWY")
HYDROPHOBIC_AA = list("VILMFWY")
CHARGED_AA = list("RKDE")
POLAR_AA = list("NQST")
STRUCTURAL_AA = list("PG")

AMPHIPATHIC_PATTERNS: list[str] = [
    "VXLXAXLX",
    "KLXLKLXLK",
    "EWLXKLXKL",
    "AXLXALAXA",
    "GLFXGLFXGL",
]

KNOWN_PEPTIDE_THERAPEUTICS: dict[str, dict] = {
    "GLP1": {
        "seq": "HGEGTFTSDVSSYLEEQAAKEFIAWLVKGRG",
        "target": "GLP1R",
        "class": "incretin_mimetic",
    },
    "Somatostatin": {"seq": "AGCKNFFWKTFTSC", "target": "SSTR2", "class": "hormone"},
    "Cyclosporine": {
        "seq": "MeBmt-Abu-Sar-MeLeu-Val-MeLeu-Ala-D-Ala-MeLeu-MeLeu-MeVal",
        "target": "CypA",
        "class": "immunosuppressant",
    },
    "Bradykinin": {"seq": "RPPGFSPF", "target": "B2R", "class": "vasoactive"},
}

MACROCYCLE_AA = list("ACDEFGHIKLMNPQRSTVWYX")
CROSSLINKERS: list[str] = ["stapled", "disulfide", "lactam", "triazole", "thioether"]


class PeptideDesignRequest(BaseModel):
    target: str = Field(..., description="Target protein or indication")
    length: int = Field(default=12, ge=5, le=50)
    cyclic: bool = Field(default=False)
    count: int = Field(default=10, ge=1, le=30)
    helical_fraction: float = Field(default=0.3, ge=0, le=1)
    hydrophobic_ratio: float = Field(default=0.4, ge=0, le=0.7)


class PeptideHit(BaseModel):
    id: str
    sequence: str
    length: int
    mw_da: float
    charge: int
    isoelectric_point: float
    hydrophobicity: float
    helical_content: float
    solubility: float
    membrane_permeability: float
    protease_stability: float
    target_affinity_nm: float
    cyclic: bool
    amphipathic_score: float


class PeptideDesignResponse(BaseModel):
    target: str
    peptides: list[PeptideHit]
    best_affinity_nm: float
    inference_ms: float


class MacrocycleDesignRequest(BaseModel):
    target: str = Field(..., description="Target protein")
    sequence_template: str = Field(default="", description="Optional template sequence")
    cyclization_type: str = Field(
        default="stapled", pattern="^(stapled|disulfide|lactam|triazole|thioether)$"
    )
    count: int = Field(default=5, ge=1, le=20)


class MacrocycleHit(BaseModel):
    id: str
    sequence: str
    cyclized_sequence: str
    cyclization_type: str
    staple_position: str
    mw_da: float
    logp: float
    conformational_stability: float
    target_affinity_nm: float
    membrane_permeability: float
    oral_bioavailability_score: float


class MacrocycleDesignResponse(BaseModel):
    target: str
    macrocycles: list[MacrocycleHit]
    inference_ms: float


def compute_peptide_properties(seq: str) -> dict:
    mw = sum(
        {
            "A": 71.09,
            "R": 156.19,
            "N": 114.11,
            "D": 115.09,
            "C": 103.15,
            "E": 129.12,
            "Q": 128.13,
            "G": 57.05,
            "H": 137.14,
            "I": 113.16,
            "L": 113.16,
            "K": 128.17,
            "M": 131.19,
            "F": 147.18,
            "P": 97.12,
            "S": 87.08,
            "T": 101.11,
            "W": 186.21,
            "Y": 163.18,
            "V": 99.14,
        }.get(aa, 110.0)
        for aa in seq
    )
    mw += 18.02

    charge = sum(1 for aa in seq if aa in "KR") - sum(1 for aa in seq if aa in "DE")
    n_hydrophobic = sum(1 for aa in seq if aa in HYDROPHOBIC_AA)
    hydrophobicity = round(n_hydrophobic / max(len(seq), 1), 3)

    n_helix_favor = sum(1 for aa in seq if aa in "ALMKE")
    helical = round(n_helix_favor / max(len(seq), 1), 3)

    n_polar = sum(1 for aa in seq if aa in POLAR_AA + CHARGED_AA)
    solubility = round(min(1.0, n_polar / max(len(seq), 1) * 1.5), 3)

    n_positive = sum(1 for aa in seq if aa in "RK")
    n_negative = sum(1 for aa in seq if aa in "DE")
    amphipathic = round(
        min(1.0, (n_positive + n_negative) / max(len(seq), 1) * hydrophobicity * 2), 3
    )

    pi = 7.0 + 0.5 * charge

    membrane = round(
        float(
            max(
                0.01,
                min(
                    0.95,
                    0.1
                    + hydrophobicity * 0.5
                    - solubility * 0.2
                    + (1.0 if len(seq) < 12 else 0.0) * 0.2,
                ),
            )
        ),
        3,
    )

    stability = round(
        float(
            max(0.1, min(1.0, 0.3 + helical * 0.3 + 0.2 * (len(seq) > 10) + 0.1 * (charge != 0)))
        ),
        3,
    )

    log_aff = 1.0 - 0.05 * len(seq) + hydrophobicity * 0.5 - 0.1 * abs(charge)
    aff = round(10 ** max(-1, min(log_aff, 3)), 2)

    return {
        "mw": round(mw, 1),
        "charge": charge,
        "pi": round(pi, 2),
        "hydrophobicity": hydrophobicity,
        "helical": helical,
        "solubility": solubility,
        "membrane": membrane,
        "stability": stability,
        "affinity": aff,
        "amphipathic": amphipathic,
    }


def random_peptide(length: int, hydrophobic_ratio: float, helical: float) -> str:
    seq = []
    for _ in range(length):
        r = random.random()
        if r < hydrophobic_ratio:
            seq.append(random.choice(HYDROPHOBIC_AA))
        elif r < hydrophobic_ratio + 0.25:
            seq.append(random.choice(CHARGED_AA))
        elif r < hydrophobic_ratio + 0.5:
            seq.append(random.choice(POLAR_AA))
        else:
            seq.append(random.choice(STRUCTURAL_AA))
    return "".join(seq)


@app.post("/design", response_model=PeptideDesignResponse)
def design_peptides(req: PeptideDesignRequest):
    start = time.time()
    random.seed(hash(f"{req.target}_{req.count}_{time.time()}") % (2**31))

    peptides = []
    seen_seqs = set()
    for _ in range(req.count * 3):
        if len(peptides) >= req.count:
            break
        seq = random_peptide(req.length, req.hydrophobic_ratio, req.helical_fraction)
        if seq in seen_seqs:
            continue
        seen_seqs.add(seq)
        props = compute_peptide_properties(seq)

        target_affinity = props["affinity"]
        if req.cyclic:
            target_affinity = round(target_affinity * 0.7, 2)
        membrane_perm = props["membrane"]
        if req.cyclic:
            membrane_perm = round(min(0.95, membrane_perm * 1.5), 3)

        peptides.append(
            PeptideHit(
                id=str(uuid.uuid4()),
                sequence=seq,
                length=len(seq),
                mw_da=props["mw"],
                charge=props["charge"],
                isoelectric_point=props["pi"],
                hydrophobicity=props["hydrophobicity"],
                helical_content=props["helical"],
                solubility=props["solubility"],
                membrane_permeability=membrane_perm,
                protease_stability=props["stability"],
                target_affinity_nm=target_affinity,
                cyclic=req.cyclic,
                amphipathic_score=props["amphipathic"],
            )
        )

    peptides.sort(key=lambda p: p.target_affinity_nm)
    best = peptides[0].target_affinity_nm if peptides else 999.0

    return PeptideDesignResponse(
        target=req.target,
        peptides=peptides,
        best_affinity_nm=best,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/macrocycle/design", response_model=MacrocycleDesignResponse)
def design_macrocycles(req: MacrocycleDesignRequest):
    start = time.time()

    if req.sequence_template:
        base_seq = req.sequence_template.upper()
    else:
        length = random.randint(8, 15)
        base_seq = "".join(random.choice(MACROCYCLE_AA) for _ in range(length))

    macrocycles = []
    for _ in range(req.count):
        if req.cyclization_type == "stapled" and len(base_seq) > 6:
            staple_pos = f"i, i+{random.randint(3, 7)}"
            cyclized = base_seq[:4] + "X" + base_seq[4:-2] + "X" + base_seq[-2:]
            mw = sum(110.0 for _ in cyclized) + 18.0
        elif req.cyclization_type == "disulfide":
            staple_pos = "Cys-Cys"
            cyclized = "C" + base_seq + "C"
            mw = sum(110.0 for _ in cyclized) + 18.0
        else:
            staple_pos = f"{req.cyclization_type}-bridge"
            cyclized = base_seq
            mw = sum(110.0 for _ in cyclized) + 18.0

        logp = round(float(-1.5 + 0.3 * cyclized.count("VILFMWY")), 2)
        stability = round(float(random.betavariate(4, 2)), 3)
        aff = round(float(10 ** random.uniform(-0.5, 1.5)), 2)
        membrane = round(float(min(0.9, 0.2 + 0.08 * cyclized.count("VILFMWY"))), 3)
        oral = round(
            float(min(1.0, membrane * 0.5 + (1.0 / (1.0 + mw / 500)) * 0.3 + stability * 0.2)), 3
        )

        macrocycles.append(
            MacrocycleHit(
                id=str(uuid.uuid4()),
                sequence=base_seq,
                cyclized_sequence=cyclized,
                cyclization_type=req.cyclization_type,
                staple_position=staple_pos,
                mw_da=round(mw, 1),
                logp=logp,
                conformational_stability=stability,
                target_affinity_nm=aff,
                membrane_permeability=membrane,
                oral_bioavailability_score=oral,
            )
        )

    macrocycles.sort(key=lambda m: m.target_affinity_nm)
    return MacrocycleDesignResponse(
        target=req.target,
        macrocycles=macrocycles,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
