import math
import random
import time
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="OmniMole Antibody Design Engine", version="1.0.0")

CDR_H3_LIBRARY: list[str] = [
    "ARYDYGMDY", "ARGGYSSGMDY", "ARDRGYSSGMDY", "ARDYYGSSGMDY",
    "ARHGYYDSSGMDY", "ARGGYYGSSGMDY", "ARGLRYFDY", "ARDGYYYGMDY",
    "ARVGYYDSSGMDY", "ARSGYYYGMDY", "ARTYYGSSGMDY", "ARDYGYYGMDY",
    "ARDDYGSSGMDY", "ARGYYDSSGMDY", "ARGGYDSSGMDY",
]

HUMAN_VH_GERMLINES: list[str] = [
    "QVQLVQSGAEVKKPGASVKVSCKASGYTFTSYYMHWVRQAPGQGLEWMGIINPSGGSTSYAQKFQGRVTMTRDTSTSTVYMELSSLRSEDTAVYYCAR",
    "EVQLVESGGGLVQPGGSLRLSCAASGFTFSSYWMSWVRQAPGKGLEWVANIKQDGSEKYYVDSVKGRFTISRDNAKNSLYLQMNSLRAEDTAVYYCAR",
    "QVQLVESGGGVVQPGRSLRLSCAASGFTFSSYSMNWVRQAPGKGLEWVAVISYDGSNKYYADSVKGRFTISRDNSKNTLYLQMNSLRAEDTAVYYCAR",
    "QVQLQQSGPGLVKPSQTLSLTCAISGDSVSSNSAAWNWIRQSPSRGLEWLGRTYYRSKWYNDYAVSVKSRITINPDTSKNQFSLQLNSVTPEDTAVYYCAR",
]

HUMAN_VL_GERMLINES: list[str] = [
    "DIQMTQSPSSLSASVGDRVTITCRASQSISSYLNWYQQKPGKAPKLLIYAASSLQSGVPSRFSGSGSGTDFTLTISSLQPEDFATYYCQQSYSTPLTFGGGTKVEIK",
    "EIVLTQSPGTLSLSPGERATLSCRASQSVSSSYLAWYQQKPGQAPRLLIYGASSRATGIPDRFSGSGSGTDFTLTISRLEPEDFAVYYCQQYGSSPLTFGGGTKVEIK",
    "DIVMTQSPDSLAVSLGERATINCKSSQSVLYSSNNKNYLAWYQQKPGQPPKLLIYWASTRESGVPDRFSGSGSGTDFTLTISSLQAEDVAVYYCQQYYSTPPTFGGGTKVEIK",
    "AIQLTQSPSSLSASVGDRVTITCRASQGISSALAWYQQKPGKAPKLLIYDASSLESGVPSRFSGSGSGTDFTLTISSLQPEDFATYYCQQFNSYPLTFGGGTKVEIK",
]

TARGET_ANTIGENS: dict[str, dict] = {
    "EGFR": {"uniprot": "P00533", "epitope": "CQLGQ", "class": "receptor_tyrosine_kinase"},
    "PD1": {"uniprot": "Q15116", "epitope": "SGQTL", "class": "immune_checkpoint"},
    "HER2": {"uniprot": "P04626", "epitope": "VLGLM", "class": "receptor_tyrosine_kinase"},
    "CD20": {"uniprot": "P11836", "epitope": "YNCEP", "class": "B_cell_marker"},
    "TNFa": {"uniprot": "P01375", "epitope": "SSQSS", "class": "cytokine"},
    "VEGFA": {"uniprot": "P15692", "epitope": "APMAE", "class": "growth_factor"},
    "CTLA4": {"uniprot": "P16410", "epitope": "VLYLP", "class": "immune_checkpoint"},
    "IL6R": {"uniprot": "P08887", "epitope": "TSRGI", "class": "cytokine_receptor"},
}


class AntibodyDesignRequest(BaseModel):
    target: str = Field(..., description="Target antigen name")
    affinity_target_nm: float = Field(default=0.1, ge=0.01, le=100)
    species: str = Field(default="humanized", pattern="^(human|humanized|murine|camelid)$")
    count: int = Field(default=5, ge=1, le=20)


class CDRRegion(BaseModel):
    region: str
    sequence: str
    length: int
    hydrophobicity: float
    predicted_affinity_nm: float
    developability_score: float


class AntibodyHit(BaseModel):
    id: str
    target: str
    vh_sequence: str
    vl_sequence: str
    cdr_h1: str
    cdr_h2: str
    cdr_h3: str
    cdr_l1: str
    cdr_l2: str
    cdr_l3: str
    predicted_affinity_nm: float
    predicted_immunogenicity: float
    developability_score: float
    stability_score: float
    solubility_score: float
    aggregation_risk: str
    human_framework: str
    format: str = "IgG1"


class AntibodyDesignResponse(BaseModel):
    target: str
    target_info: dict
    antibodies: list[AntibodyHit]
    top_cdr3_sequences: list[str]
    inference_ms: float


class CDREngineeringRequest(BaseModel):
    cdr_loop: str = Field(..., description="CDR loop type (H1, H2, H3, L1, L2, L3)")
    template_sequence: str = Field(..., description="Template CDR sequence")
    target_affinity_nm: float = Field(default=0.5)
    mutations: int = Field(default=2, ge=1, le=10)


class CDREngineeringResponse(BaseModel):
    variants: list[dict]
    template: str
    cdr_loop: str
    total_variants: int


class DevelopabilityRequest(BaseModel):
    vh_sequence: str
    vl_sequence: str


class DevelopabilityResponse(BaseModel):
    overall_score: float
    stability: float
    solubility: float
    aggregation_risk: str
    immunogenicity: float
    viscosity_risk: str
    expression_estimate: str
    patches: list[dict]


def compute_cdr_affinity(cdr_seq: str) -> float:
    n_aromatic = sum(cdr_seq.count(aa) for aa in "YWFH")
    n_charged = sum(cdr_seq.count(aa) for aa in "RKDE")
    length = len(cdr_seq)
    hydrophobicity = (n_aromatic / max(length, 1)) * 5
    log_aff = 0.5 - 0.08 * length + 0.15 * n_aromatic - 0.1 * n_charged + 0.05 * hydrophobicity
    return round(10 ** max(-1.5, min(log_aff, 2.5)), 2)


def compute_developability(vh: str, vl: str) -> tuple[float, float, float, str]:
    total_len = len(vh) + len(vl)
    n_glycosylation = vh.count("NXT") + vh.count("NXS") + vl.count("NXT") + vl.count("NXS")
    n_charged = sum(vh.count(aa) for aa in "RKDE") + sum(vl.count(aa) for aa in "RKDE")
    n_hydrophobic = sum(vh.count(aa) for aa in "VILFMW") + sum(vl.count(aa) for aa in "VILFMW")

    stability = round(min(1.0, 0.4 + 0.01 * total_len - 0.05 * n_glycosylation), 3)
    solubility = round(min(1.0, 0.5 + 0.02 * n_charged - 0.01 * n_hydrophobic), 3)
    aggregation = "high" if n_hydrophobic / max(total_len, 1) > 0.3 else "medium" if n_hydrophobic / max(total_len, 1) > 0.2 else "low"

    return stability, solubility, 1.0 - n_glycosylation * 0.1, aggregation


def compute_immunogenicity(vh: str, vl: str) -> float:
    t_cell_epitopes = 0
    for motif in ["YFW", "LLL", "VAV", "ILM", "RKD"]:
        t_cell_epitopes += vh.count(motif) + vl.count(motif)
    return round(min(1.0, 0.1 + 0.05 * t_cell_epitopes), 3)


def mutate_cdr(seq: str, mutations: int) -> list[str]:
    aa_set = list("ACDEFGHIKLMNPQRSTVWY")
    variants = set()
    for _ in range(min(50, 10 * mutations)):
        seq_list = list(seq)
        for _ in range(mutations):
            pos = random.randint(0, len(seq) - 1)
            orig = seq_list[pos]
            new = random.choice([a for a in aa_set if a != orig])
            seq_list[pos] = new
        new_seq = "".join(seq_list)
        if new_seq != seq:
            variants.add(new_seq)
    return list(variants)[:20]


@app.post("/design", response_model=AntibodyDesignResponse)
def design_antibodies(req: AntibodyDesignRequest):
    start = time.time()
    target = req.target.upper()
    if target not in TARGET_ANTIGENS:
        allowed = list(TARGET_ANTIGENS.keys())
        close_matches = [t for t in allowed if t[:2] == target[:2]]
        if close_matches:
            target = close_matches[0]
        else:
            target = "EGFR"

    target_info = TARGET_ANTIGENS[target]

    antibodies = []
    rng = random.Random(f"{target}_{req.species}_{req.count}_{time.time()}")
    for i in range(req.count):
        vh = rng.choice(HUMAN_VH_GERMLINES)
        vl = rng.choice(HUMAN_VL_GERMLINES)

        cdr_h3 = rng.choice(CDR_H3_LIBRARY)
        cdr_h1 = vh[26:35] if len(vh) > 35 else "GFTFSSY"
        cdr_h2 = vh[50:66] if len(vh) > 66 else "ISGGGST"
        cdr_l1 = vl[24:34] if len(vl) > 34 else "RASQSISS"
        cdr_l2 = vl[50:56] if len(vl) > 56 else "AASSLQS"
        cdr_l3 = vl[89:97] if len(vl) > 97 else "QQSYSTPL"

        affinity_nm = compute_cdr_affinity(cdr_h3)
        affinity_nm = round(affinity_nm * (0.5 + 0.5 * (req.affinity_target_nm / 0.5)), 2)

        stability, solubility, dev_score, aggregation_risk = compute_developability(vh, vl)
        immunogenicity = compute_immunogenicity(vh, vl)

        antibodies.append(AntibodyHit(
            id=str(uuid.uuid4()),
            target=target,
            vh_sequence=vh,
            vl_sequence=vl,
            cdr_h1=cdr_h1,
            cdr_h2=cdr_h2,
            cdr_h3=cdr_h3,
            cdr_l1=cdr_l1,
            cdr_l2=cdr_l2,
            cdr_l3=cdr_l3,
            predicted_affinity_nm=affinity_nm,
            predicted_immunogenicity=immunogenicity,
            developability_score=round((stability + solubility + dev_score) / 3, 3),
            stability_score=stability,
            solubility_score=solubility,
            aggregation_risk=aggregation_risk,
            human_framework=req.species,
            format="IgG1",
        ))

    antibodies.sort(key=lambda a: a.predicted_affinity_nm)

    return AntibodyDesignResponse(
        target=target,
        target_info=target_info,
        antibodies=antibodies,
        top_cdr3_sequences=[a.cdr_h3 for a in antibodies[:5]],
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/cdr-engineering", response_model=CDREngineeringResponse)
def engineer_cdr(req: CDREngineeringRequest):
    variants = mutate_cdr(req.template_sequence, req.mutations)
    variant_data = []
    for seq in variants:
        aff = compute_cdr_affinity(seq)
        variant_data.append({
            "sequence": seq,
            "length": len(seq),
            "predicted_affinity_nm": aff,
            "improvement_factor": round(max(0.5, 1.0 / (aff / 0.5)), 3),
            "mutation_count": sum(1 for a, b in zip(seq, req.template_sequence) if a != b),
        })
    variant_data.sort(key=lambda x: x["predicted_affinity_nm"])

    return CDREngineeringResponse(
        variants=variant_data,
        template=req.template_sequence,
        cdr_loop=req.cdr_loop,
        total_variants=len(variant_data),
    )


@app.post("/developability", response_model=DevelopabilityResponse)
def predict_developability(req: DevelopabilityRequest):
    stability, solubility, _, aggregation_risk = compute_developability(req.vh_sequence, req.vl_sequence)
    immunogenicity = compute_immunogenicity(req.vh_sequence, req.vl_sequence)
    overall = round((stability + solubility + (1 - immunogenicity)) / 3, 3)

    combo = req.vh_sequence + req.vl_sequence
    hydrophobic_patches = []
    for i in range(len(combo) - 2):
        patch = combo[i:i + 3]
        if all(aa in "VILFMWY" for aa in patch):
            hydrophobic_patches.append({"position": i, "sequence": patch, "type": "hydrophobic"})

    viscosity = "high" if sum(1 for aa in combo if aa in "RKD") > 30 else "low"
    expression = "high" if len(combo) > 400 and len(combo) < 480 else "medium"

    return DevelopabilityResponse(
        overall_score=overall,
        stability=stability,
        solubility=solubility,
        aggregation_risk=aggregation_risk,
        immunogenicity=immunogenicity,
        viscosity_risk=viscosity,
        expression_estimate=expression,
        patches=hydrophobic_patches[:5],
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "targets": list(TARGET_ANTIGENS.keys()),
        "germlines_vh": len(HUMAN_VH_GERMLINES),
        "germlines_vl": len(HUMAN_VL_GERMLINES),
    }
