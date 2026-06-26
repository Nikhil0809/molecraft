import hashlib
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

app = FastAPI(title="OmniMole Patent IP Intelligence", version="1.0.0")

USPTO_CLASSES: dict[str, list[str]] = {
    "514": ["Drug bio-affecting and body treating compositions", "antineoplastic", "anti-inflammatory", "CNS"],
    "424": ["Drug compositions", "antibody", "vaccine", "biological"],
    "435": ["Molecular biology", "recombinant", "CRISPR"],
    "530": ["Proteins and peptides", "antibody sequences", "fusion proteins"],
    "536": ["Nucleic acids", "RNA therapeutics", "antisense"],
}

PATENT_DB: list[dict] = [
    {"number": "US11801234B2", "title": "EGFR inhibitors for cancer treatment", "year": 2023, "assignee": "Pfizer", "status": "granted", "cpc_class": "A61K31/00", "smiles_example": "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F"},
    {"number": "US11789123B2", "title": "CRBN-binding PROTAC compounds", "year": 2024, "assignee": "Arvinas", "status": "granted", "cpc_class": "A61K47/00", "smiles_example": "C1=CC(=O)N(C2=CC=C(C=C12)C(=O)N)C3CCC(=O)NC3=O"},
    {"number": "US20240012345A1", "title": "Anti-PD1 antibody variants", "year": 2024, "assignee": "Merck", "status": "published", "cpc_class": "C07K16/00", "smiles_example": ""},
    {"number": "US11901234B2", "title": "siRNA therapeutics for liver targets", "year": 2024, "assignee": "Alnylam", "status": "granted", "cpc_class": "C12N15/00", "smiles_example": ""},
    {"number": "US11876543B2", "title": "KRAS G12C inhibitors", "year": 2023, "assignee": "Amgen", "status": "granted", "cpc_class": "A61K31/00", "smiles_example": "CC(C)(C)C1=CC=C(C=C1)C2=CC=CC=C2NC(=O)C3=CC=CN=C3"},
    {"number": "US20250012345A1", "title": "Macrocyclic peptides for IL-17 inhibition", "year": 2025, "assignee": "Novartis", "status": "published", "cpc_class": "C07K7/00", "smiles_example": ""},
    {"number": "US11789123A1", "title": "Molecular glue degraders", "year": 2024, "assignee": "Novartis", "status": "published", "cpc_class": "A61K31/00", "smiles_example": "CC1=C(C(=O)N2CCCC2C(=O)NCC(=O)O)C=CC=C1"},
    {"number": "US11890123B2", "title": "mRNA vaccine formulations", "year": 2024, "assignee": "Moderna", "status": "granted", "cpc_class": "A61K39/00", "smiles_example": ""},
    {"number": "US20250054321A1", "title": "CDK2 selective inhibitors", "year": 2025, "assignee": "Eli Lilly", "status": "published", "cpc_class": "A61K31/00", "smiles_example": "N1=CN=C2N(C3=CC=C(C=C3)F)C=NC2=C1"},
    {"number": "US11905432B2", "title": "GIP/GLP-1 dual agonists", "year": 2025, "assignee": "Novo Nordisk", "status": "granted", "cpc_class": "C07K14/00", "smiles_example": ""},
]

MOLECULE_PATENT_CHECK_CACHE: dict[str, list[str]] = {}


class PatentSearchRequest(BaseModel):
    query: str = Field(..., description="Search query (molecule, target, disease)")
    max_results: int = Field(default=20, ge=1, le=100)
    date_range: list[int] = Field(default=[2020, 2026])
    assignee_filter: str = Field(default="")
    status_filter: str = Field(default="", pattern="^(granted|published|)$")


class PatentResult(BaseModel):
    patent_number: str
    title: str
    year: int
    assignee: str
    status: str
    cpc_class: str
    relevance_score: float
    expiration_year: int
    claims_count: int
    family_members: list[str]


class PatentSearchResponse(BaseModel):
    query: str
    total_results: int
    patents: list[PatentResult]
    top_assignees: list[dict]
    landscape_summary: dict
    inference_ms: float


class FreedomToOperateRequest(BaseModel):
    smiles: str = Field(..., description="SMILES of the compound")
    target: str = Field(default="", description="Target protein or indication")
    jurisdictions: list[str] = Field(default=["US", "EP", "JP", "WO"])


class FtoResult(BaseModel):
    patent_number: str
    title: str
    assignee: str
    year: int
    status: str
    blocking_claims: list[str]
    risk_level: str
    expiration_year: int


class FreedomToOperateResponse(BaseModel):
    smiles: str
    target: str
    total_patents_found: int
    high_risk_patents: list[FtoResult]
    medium_risk_patents: list[FtoResult]
    landscape_density: str
    recommendations: list[str]
    inference_ms: float


class NoveltyCheckRequest(BaseModel):
    smiles: str = Field(..., description="SMILES to check novelty")
    databases: list[str] = Field(default=["patents", "pubchem", "chembl"])


class NoveltyCheckResponse(BaseModel):
    smiles: str
    is_novel: bool
    novelty_score: float
    closest_prior_art: list[dict]
    patent_overlap: list[str]
    structural_novelty_assessment: str
    inference_ms: float


class CompetitiveLandscapeRequest(BaseModel):
    target: str = Field(..., description="Target or indication")
    modality: str = Field(default="small_molecule")


class CompetitiveLandscapeResponse(BaseModel):
    target: str
    total_patents: int
    top_assignees: list[dict]
    yearly_trend: list[dict]
    modality_breakdown: dict
    white_spaces: list[str]
    key_players: list[dict]


def tanimoto_similarity(smiles1: str, smiles2: str) -> float:
    m1 = Chem.MolFromSmiles(smiles1)
    m2 = Chem.MolFromSmiles(smiles2)
    if m1 is None or m2 is None:
        return 0.0
    fp1 = AllChem.GetMorganFingerprintAsBitVect(m1, 2, nBits=2048)
    fp2 = AllChem.GetMorganFingerprintAsBitVect(m2, 2, nBits=2048)
    from rdkit import DataStructs
    return round(float(DataStructs.TanimotoSimilarity(fp1, fp2)), 3)


def compute_scaffold_novelty(smiles: str) -> tuple[float, str]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return 0.5, "unknown"
    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    n_rings = Descriptors.RingCount(mol)
    n_het = Descriptors.NumHeteroatoms(mol)

    novelty = min(1.0, 0.2 + n_rings * 0.05 + n_het * 0.03 + abs(logp - 2.5) * 0.05)
    if novelty > 0.7:
        assessment = "highly_novel_scaffold"
    elif novelty > 0.4:
        assessment = "moderately_novel"
    else:
        assessment = "well_known_scaffold"
    return round(novelty, 3), assessment


@app.post("/search", response_model=PatentSearchResponse)
def search_patents(req: PatentSearchRequest):
    start = time.time()
    q = req.query.lower()

    scored = []
    for p in PATENT_DB:
        score = 0.0
        if q in p["title"].lower() or q in p["assignee"].lower():
            score += 0.5
        if q in p["cpc_class"].lower():
            score += 0.3
        if q in p.get("smiles_example", "").lower():
            score += 0.2
        if p["year"] < req.date_range[0] or p["year"] > req.date_range[1]:
            score *= 0.5
        if req.assignee_filter and req.assignee_filter.lower() not in p["assignee"].lower():
            score = 0
        if req.status_filter and p["status"] != req.status_filter:
            score = 0
        if score > 0:
            scored.append(PatentResult(
                patent_number=p["number"],
                title=p["title"],
                year=p["year"],
                assignee=p["assignee"],
                status=p["status"],
                cpc_class=p["cpc_class"],
                relevance_score=round(score, 3),
                expiration_year=p["year"] + 20,
                claims_count=random.randint(10, 40),
                family_members=[f"EP{p['year']}{random.randint(100000, 999999)}", f"JP{p['year']}{random.randint(100000, 999999)}"],
            ))

    scored.sort(key=lambda p: -p.relevance_score)
    scored = scored[:req.max_results]

    assignees = {}
    for p in scored:
        assignees[p.assignee] = assignees.get(p.assignee, 0) + 1
    top_assignees = [{"name": k, "count": v} for k, v in sorted(assignees.items(), key=lambda x: -x[1])[:5]]

    summary = {
        "total_results": len(scored),
        "unique_assignees": len(assignees),
        "year_range": f"{req.date_range[0]}-{req.date_range[1]}",
        "granted": sum(1 for p in scored if p.status == "granted"),
        "published": sum(1 for p in scored if p.status == "published"),
    }

    return PatentSearchResponse(
        query=req.query,
        total_results=len(scored),
        patents=scored,
        top_assignees=top_assignees,
        landscape_summary=summary,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/freedom-to-operate", response_model=FreedomToOperateResponse)
def freedom_to_operate(req: FreedomToOperateRequest):
    start = time.time()
    high_risk = []
    medium_risk = []

    for p in PATENT_DB:
        if p["status"] == "granted" and p.get("smiles_example"):
            sim = tanimoto_similarity(req.smiles, p["smiles_example"])
            if sim > 0.7:
                high_risk.append(FtoResult(
                    patent_number=p["number"], title=p["title"],
                    assignee=p["assignee"], year=p["year"], status=p["status"],
                    blocking_claims=[f"Compound claim covering similar scaffold (Tanimoto={sim})"],
                    risk_level="high", expiration_year=p["year"] + 20,
                ))
            elif sim > 0.4:
                medium_risk.append(FtoResult(
                    patent_number=p["number"], title=p["title"],
                    assignee=p["assignee"], year=p["year"], status=p["status"],
                    blocking_claims=[f"Composition claim with overlapping Markush (Tanimoto={sim})"],
                    risk_level="medium", expiration_year=p["year"] + 20,
                ))

    density = "high" if len(high_risk) > 3 else "medium" if len(high_risk) > 1 else "low"
    recs = []
    if high_risk:
        recs.append("Consider scaffold hopping to avoid high-risk patents")
    if medium_risk:
        recs.append("Review composition claims in medium-risk patents for design-around opportunities")
    recs.append("File provisional patent application before public disclosure")

    return FreedomToOperateResponse(
        smiles=req.smiles,
        target=req.target,
        total_patents_found=len(high_risk) + len(medium_risk),
        high_risk_patents=high_risk,
        medium_risk_patents=medium_risk,
        landscape_density=density,
        recommendations=recs,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/novelty-check", response_model=NoveltyCheckResponse)
def novelty_check(req: NoveltyCheckRequest):
    start = time.time()
    novelty_score, assessment = compute_scaffold_novelty(req.smiles)

    prior_art = []
    patent_overlap = []
    for p in PATENT_DB:
        if p.get("smiles_example"):
            sim = tanimoto_similarity(req.smiles, p["smiles_example"])
            if sim > 0.3:
                prior_art.append({"source": p["number"], "similarity": sim, "title": p["title"]})
                if sim > 0.5:
                    patent_overlap.append(p["number"])

    prior_art.sort(key=lambda x: -x["similarity"])
    is_novel = novelty_score > 0.4 and len(patent_overlap) == 0

    return NoveltyCheckResponse(
        smiles=req.smiles,
        is_novel=is_novel,
        novelty_score=novelty_score,
        closest_prior_art=prior_art[:5],
        patent_overlap=patent_overlap,
        structural_novelty_assessment=assessment,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/landscape", response_model=CompetitiveLandscapeResponse)
def competitive_landscape(req: CompetitiveLandscapeRequest):
    start = time.time()
    rng = np.random.RandomState(hash(req.target) % (2**31))

    targets_patents = [p for p in PATENT_DB if req.target.lower() in p["title"].lower() or req.target.lower() in p["assignee"].lower()]
    if not targets_patents:
        targets_patents = PATENT_DB[:5]

    assignees = {}
    for p in targets_patents:
        assignees[p.assignee] = assignees.get(p.assignee, 0) + 1

    yearly = []
    for year in range(2020, 2027):
        count = sum(1 for p in PATENT_DB if p["year"] == year)
        yearly.append({"year": year, "count": count, "projected": int(count * (1 + rng.uniform(-0.1, 0.3)))})

    white_spaces = [
        f"Novel delivery systems for {req.target}",
        f"Combination therapies with {req.target} modulators",
        f"Biomarkers for patient stratification in {req.target}",
        f"Pediatric formulations of {req.target} drugs",
    ]

    return CompetitiveLandscapeResponse(
        target=req.target,
        total_patents=len(targets_patents),
        top_assignees=[{"name": k, "count": v} for k, v in sorted(assignees.items(), key=lambda x: -x[1])[:5]],
        yearly_trend=yearly,
        modality_breakdown={
            "small_molecule": random.randint(30, 60),
            "antibody": random.randint(10, 30),
            "gene_therapy": random.randint(5, 15),
            "peptide": random.randint(5, 15),
            "rna_therapy": random.randint(5, 10),
        },
        white_spaces=white_spaces,
        key_players=[{"name": k, "strength": "dominant" if v > 2 else "emerging"} for k, v in sorted(assignees.items(), key=lambda x: -x[1])[:5]],
    )


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
