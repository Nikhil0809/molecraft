import math
import random
import time
import uuid
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="OmniMole RNA Therapeutics Design", version="1.0.0")

RNA_NUCLEOTIDES = ["A", "C", "G", "U"]
RNA_COMPLEMENT = {"A": "U", "U": "A", "C": "G", "G": "C"}

SIRNA_SEED = "UGGCCAACUGA"

ASO_GAPMER_PATTERNS: dict[str, list[str]] = [
    "CCCT", "AGGG", "TTAGGG", "GGCG", "CGCC", "GCTG", "CAGC",
    "ACTG", "TGAC", "GTCA", "TCAG", "CTGA", "GACT", "AGTC",
]


class siRNADesignRequest(BaseModel):
    target_gene: str = Field(..., description="Target gene symbol or sequence")
    target_sequence: str = Field(default="", description="mRNA target sequence (optional)")
    species: str = Field(default="human")
    length: int = Field(default=21, ge=19, le=27)
    count: int = Field(default=5, ge=1, le=20)
    avoid_seeds: list[str] = Field(default=[])


class siRNAHit(BaseModel):
    id: str
    sense_strand: str
    antisense_strand: str
    target_gene: str
    target_region: str
    gc_content: float
    melting_temp_c: float
    off_target_score: float
    efficacy_score: float
    seed_avoided: bool
    modification_pattern: str


class siRNADesignResponse(BaseModel):
    target_gene: str
    designs: list[siRNAHit]
    target_region_found: bool
    inference_ms: float


class ASODesignRequest(BaseModel):
    target_rna: str = Field(..., description="Target RNA sequence or gene")
    gapmer: bool = Field(default=True)
    length: int = Field(default=20, ge=15, le=25)
    count: int = Field(default=5)


class ASOHit(BaseModel):
    id: str
    sequence: str
    length: int
    gc_content: float
    melting_temp_c: float
    rnase_h_activity: float
    duplex_stability: float
    self_complementarity: float
    modification_pattern: str
    gapmer_config: dict


class ASODesignResponse(BaseModel):
    target: str
    designs: list[ASOHit]
    inference_ms: float


class mRNADesignRequest(BaseModel):
    protein_sequence: str = Field(..., description="Target protein sequence")
    codon_optimization: str = Field(default="human", pattern="^(human|mouse|ecoli|yeast)$")
    count: int = Field(default=1, ge=1, le=5)


class mRNADesignResponse(BaseModel):
    sequences: list[dict]
    codon_adaptation_index: float
    gc_content: float
    predicted_expression: float
    stability_score: float


COMPLEMENTARY_SEQUENCES: dict[str, list[str]] = {
    "EGFR": ["GAUCCAGAGGUUCAAGUG", "GACUAUCUCAGCAUCGUC", "GCAUCGUGGACAACAACA"],
    "TNF": ["GAUGAGGUUACUGACAU", "GACAACCAACUAGUGGU", "CAGCAUGGUUGUGAGC"],
    "KRAS": ["GGACCAGUACAUGAGGA", "GACGAATACGACCCAA", "GTCACAGGATCAAGTC"],
    "APP": ["GACUCAGCACUACAGU", "GACAAAGCCGCCUCCA", "CAUCAUGCUGCUGCCA"],
    "SNCA": ["GACUGUGACUCCUCCA", "GCAUCGGACUACAUA", "GACAAAACAGCACGGU"],
}


def gc_content(seq: str) -> float:
    gc = sum(1 for n in seq.upper() if n in "GC")
    return round(gc / max(len(seq), 1), 3)


def melting_temp(seq: str) -> float:
    gc = gc_content(seq) * 100
    length = len(seq)
    if length < 14:
        tm = 2 * (length - gc / 100 * length) + 4 * (gc / 100 * length)
    else:
        tm = 64.9 + 41 * (gc / 100 - 16.4) / length
    return round(tm, 1)


def reverse_complement(seq: str) -> str:
    return "".join(RNA_COMPLEMENT.get(n, n) for n in seq.upper()[::-1])


def design_sirna(target: str, length: int) -> tuple[str, str, str]:
    region = "CDS"
    if len(target) < length + 10:
        target = target * ((length + 50) // len(target) + 1)
    start = random.randint(0, max(0, len(target) - length - 5))
    sense = target[start:start + length]
    antisense = reverse_complement(sense)
    return sense, antisense, region


@app.post("/sirna/design", response_model=siRNADesignResponse)
def design_sirna(req: siRNADesignRequest):
    start = time.time()
    gene = req.target_gene.upper()

    if req.target_sequence:
        target_seq = req.target_sequence.upper().replace("T", "U")
    elif gene in COMPLEMENTARY_SEQUENCES:
        target_seq = COMPLEMENTARY_SEQUENCES[gene][0]
    else:
        target_seq = "AUGGCGACCCUGGAUGAGCU"

    designs = []
    for i in range(req.count):
        sense, antisense, region = design_sirna(target_seq, req.length)
        gc = gc_content(sense)
        tm = melting_temp(sense)
        off_target = round(float(np.random.beta(2, 5)), 3)
        seed = sense[2:8]
        seed_avoided = seed not in req.avoid_seeds

        efficacy = round(float(max(0.1, min(0.95, 0.5 + 0.3 * (0.5 - abs(gc - 0.5)) - off_target * 0.3 + 0.1 * seed_avoided))), 3)

        mod_pattern = "2'-OMe + PS" if random.random() > 0.3 else "2'-F + 2'-OMe"

        designs.append(siRNAHit(
            id=str(uuid.uuid4()),
            sense_strand=sense,
            antisense_strand=antisense,
            target_gene=gene,
            target_region=region,
            gc_content=gc,
            melting_temp_c=tm,
            off_target_score=off_target,
            efficacy_score=efficacy,
            seed_avoided=seed_avoided,
            modification_pattern=mod_pattern,
        ))

    designs.sort(key=lambda s: -s.efficacy_score)
    return siRNADesignResponse(
        target_gene=gene,
        designs=designs,
        target_region_found=bool(req.target_sequence or gene in COMPLEMENTARY_SEQUENCES),
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/aso/design", response_model=ASODesignResponse)
def design_aso(req: ASODesignRequest):
    start = time.time()
    target = req.target_rna.upper()
    if len(target) < req.length:
        target = target * (req.length // len(target) + 1)

    designs = []
    for i in range(req.count):
        offset = random.randint(0, max(0, len(target) - req.length))
        seq = target[offset:offset + req.length]
        gc = gc_content(seq)
        tm = melting_temp(seq)

        rnase_h = round(float(min(0.9, 0.3 + gc * 0.5)), 3)
        duplex = round(float(min(1.0, 0.5 + gc * 0.3 - abs(tm - 55) * 0.01)), 3)
        self_comp = round(float(sum(1 for j in range(len(seq) // 2) if seq[j] == seq[-1 - j]) / max(len(seq) / 2, 1)), 3)

        gapmer_config = {}
        if req.gapmer:
            gap_len = req.length - 10
            if gap_len > 0:
                gapmer_config = {
                    "5_wing": seq[:5],
                    "gap": seq[5:5 + gap_len],
                    "3_wing": seq[5 + gap_len:],
                    "gap_length": gap_len,
                    "modifications": "PS + 2'-OMe wings, DNA gap",
                }

        designs.append(ASOHit(
            id=str(uuid.uuid4()),
            sequence=seq,
            length=len(seq),
            gc_content=gc,
            melting_temp_c=tm,
            rnase_h_activity=rnase_h,
            duplex_stability=duplex,
            self_complementarity=self_comp,
            modification_pattern="PS backbone + 2'-OMe" if req.gapmer else "PS backbone",
            gapmer_config=gapmer_config,
        ))

    designs.sort(key=lambda a: -a.rnase_h_activity)
    return ASODesignResponse(
        target=req.target_rna[:50],
        designs=designs,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/mrna/optimize", response_model=mRNADesignResponse)
def optimize_mrna(req: mRNADesignRequest):
    start = time.time()
    codon_table = {
        "human": {"A": "GCC", "C": "TGC", "D": "GAC", "E": "GAG", "F": "TTC", "G": "GGC", "H": "CAC",
                  "I": "ATC", "K": "AAG", "L": "CTG", "M": "ATG", "N": "AAC", "P": "CCC", "Q": "CAG",
                  "R": "CGG", "S": "AGC", "T": "ACC", "V": "GTG", "W": "TGG", "Y": "TAC"},
    }
    cai = round(float(np.random.uniform(0.7, 0.95)), 3)
    gc = round(float(np.random.uniform(0.4, 0.65)), 3)
    expression = round(float(0.3 + 0.5 * cai + 0.2 * gc), 3)

    sequences = []
    for i in range(req.count):
        coding = "".join(codon_table.get(req.codon_optimization, codon_table["human"]).get(aa[:1], "NNN") for aa in req.protein_sequence[:50])
        seq = f"AG{chr(65+i)}UG{chr(65+i)}GC{chr(65+i)}{coding}UAG{chr(68+i)}A{chr(65+i)}"
        sequences.append({
            "id": str(uuid.uuid4()),
            "sequence": seq,
            "length": len(seq),
            "coding_region_length": len(coding),
            "utr5": "AGCU",
            "utr3": "UAGAUAA",
            "polyA_tail": "A" * random.randint(100, 150),
        })

    return mRNADesignResponse(
        sequences=sequences,
        codon_adaptation_index=cai,
        gc_content=gc,
        predicted_expression=expression,
        stability_score=round(float(min(1.0, gc * 0.5 + cai * 0.3)), 3),
    )


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
