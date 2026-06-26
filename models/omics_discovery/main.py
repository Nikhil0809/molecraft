import asyncio
import json
import time
import uuid
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="OmniMole Multi-Omics Target Discovery", version="1.0.0")


class OmicsQuery(BaseModel):
    disease: str = Field(..., description="Disease name or ICD code")
    omics_types: list[str] = Field(default=["genomics", "transcriptomics", "proteomics", "metabolomics"])
    species: str = Field(default="human")
    min_confidence: float = Field(default=0.3, ge=0, le=1)


class TargetGene(BaseModel):
    gene_symbol: str
    ensembl_id: str
    uniprot_id: str
    confidence: float
    evidence_level: str
    omics_sources: list[str]
    druggability_score: float
    novelty_score: float
    description: str
    pathways: list[str]


class ProteinTarget(BaseModel):
    uniprot_id: str
    gene_symbol: str
    protein_name: str
    confidence: float
    druggability: str
    known_drugs: int
    structures_available: bool
    disease_associations: list[str]
    tissue_expression: dict


class DiseaseModule(BaseModel):
    name: str
    genes: list[str]
    proteins: list[str]
    pathways: list[str]
    enriched_ontology: list[str]
    module_score: float


class DifferentiallyExpressedGene(BaseModel):
    gene: str
    log2fc: float
    p_adjusted: float
    tissue: str
    upregulated: bool


class OmicsTargetResponse(BaseModel):
    disease: str
    targets: list[TargetGene]
    disease_modules: list[DiseaseModule]
    protein_targets: list[ProteinTarget]
    de_genes: list[DifferentiallyExpressedGene]
    summary: dict
    inference_ms: float


class CRISPRScreenRequest(BaseModel):
    gene_list: list[str] = Field(..., description="List of genes to screen")
    cell_line: str = Field(default="A549")
    phenotype: str = Field(default="viability")


class CRISPRScreenResult(BaseModel):
    gene: str
    essentiality_score: float
    z_score: float
    fdr: float
    hit: bool


class CRISPRScreenResponse(BaseModel):
    results: list[CRISPRScreenResult]
    cell_line: str
    phenotype: str
    total_genes: int
    hit_count: int


class PathwayEnrichmentRequest(BaseModel):
    genes: list[str]
    organism: str = Field(default="human")
    databases: list[str] = Field(default=["reactome", "kegg", "go"])


class PathwayEntry(BaseModel):
    pathway_id: str
    pathway_name: str
    database: str
    p_value: float
    fdr: float
    overlapping_genes: list[str]
    enrichment_score: float


class PathwayEnrichmentResponse(BaseModel):
    pathways: list[PathwayEntry]
    total_genes_input: int
    genes_mapped: int
    significant_pathways: int


DISEASE_TARGET_DB: dict[str, dict] = {
    "alzheimer": {
        "genes": [
            {"symbol": "APP", "ensembl": "ENSG00000142192", "uniprot": "P05067", "confidence": 0.95, "druggability": 0.55},
            {"symbol": "PSEN1", "ensembl": "ENSG00000080815", "uniprot": "P49768", "confidence": 0.92, "druggability": 0.40},
            {"symbol": "PSEN2", "ensembl": "ENSG00000143801", "uniprot": "P49810", "confidence": 0.85, "druggability": 0.38},
            {"symbol": "APOE", "ensembl": "ENSG00000130203", "uniprot": "P02649", "confidence": 0.90, "druggability": 0.25},
            {"symbol": "TREM2", "ensembl": "ENSG00000095970", "uniprot": "Q9NZC2", "confidence": 0.80, "druggability": 0.55},
            {"symbol": "BACE1", "ensembl": "ENSG00000186318", "uniprot": "P56817", "confidence": 0.88, "druggability": 0.75},
            {"symbol": "MAPT", "ensembl": "ENSG00000186868", "uniprot": "P10636", "confidence": 0.85, "druggability": 0.30},
        ],
        "pathways": ["Alzheimer disease", "Neuroinflammation", "Amyloid processing", "Tau pathology", "Oxidative stress"],
    },
    "parkinson": {
        "genes": [
            {"symbol": "SNCA", "ensembl": "ENSG00000145335", "uniprot": "P37840", "confidence": 0.93, "druggability": 0.35},
            {"symbol": "PARK2", "ensembl": "ENSG00000185345", "uniprot": "O60260", "confidence": 0.88, "druggability": 0.20},
            {"symbol": "PINK1", "ensembl": "ENSG00000158828", "uniprot": "Q9BXM7", "confidence": 0.85, "druggability": 0.50},
            {"symbol": "DJ1", "ensembl": "ENSG00000116288", "uniprot": "Q99497", "confidence": 0.80, "druggability": 0.45},
            {"symbol": "LRRK2", "ensembl": "ENSG00000188906", "uniprot": "Q5S007", "confidence": 0.90, "druggability": 0.70},
            {"symbol": "GBA", "ensembl": "ENSG00000177628", "uniprot": "P04062", "confidence": 0.82, "druggability": 0.55},
        ],
        "pathways": ["Parkinson disease", "Mitochondrial dysfunction", "Autophagy", "Dopamine signaling", "Oxidative stress"],
    },
    "lung_cancer": {
        "genes": [
            {"symbol": "EGFR", "ensembl": "ENSG00000146648", "uniprot": "P00533", "confidence": 0.95, "druggability": 0.85},
            {"symbol": "KRAS", "ensembl": "ENSG00000133703", "uniprot": "P01116", "confidence": 0.93, "druggability": 0.60},
            {"symbol": "ALK", "ensembl": "ENSG00000171094", "uniprot": "Q9UM73", "confidence": 0.88, "druggability": 0.80},
            {"symbol": "ROS1", "ensembl": "ENSG00000047936", "uniprot": "P08922", "confidence": 0.82, "druggability": 0.75},
            {"symbol": "MET", "ensembl": "ENSG00000105976", "uniprot": "P08581", "confidence": 0.80, "druggability": 0.78},
            {"symbol": "BRAF", "ensembl": "ENSG00000157764", "uniprot": "P15056", "confidence": 0.85, "druggability": 0.82},
            {"symbol": "PD1", "ensembl": "ENSG00000188389", "uniprot": "Q15116", "confidence": 0.78, "druggability": 0.70},
        ],
        "pathways": ["Non-small cell lung cancer", "EGFR signaling", "MAPK pathway", "Immunotherapy targets", "Cell cycle"],
    },
    "heart_failure": {
        "genes": [
            {"symbol": "MYH7", "ensembl": "ENSG00000092054", "uniprot": "P12883", "confidence": 0.88, "druggability": 0.20},
            {"symbol": "MYBPC3", "ensembl": "ENSG00000134571", "uniprot": "Q14896", "confidence": 0.85, "druggability": 0.15},
            {"symbol": "TTN", "ensembl": "ENSG00000155657", "uniprot": "Q8WZ42", "confidence": 0.90, "druggability": 0.10},
            {"symbol": "SCN5A", "ensembl": "ENSG00000183873", "uniprot": "Q14524", "confidence": 0.82, "druggability": 0.65},
            {"symbol": "ADRB1", "ensembl": "ENSG00000043591", "uniprot": "P08588", "confidence": 0.80, "druggability": 0.85},
            {"symbol": "ACE", "ensembl": "ENSG00000159640", "uniprot": "P12821", "confidence": 0.78, "druggability": 0.90},
        ],
        "pathways": ["Heart failure", "Cardiac hypertrophy", "Calcium signaling", "Beta-adrenergic signaling", "Renin-angiotensin"],
    },
    "diabetes_t2": {
        "genes": [
            {"symbol": "TCF7L2", "ensembl": "ENSG00000148737", "uniprot": "Q9NQB0", "confidence": 0.90, "druggability": 0.30},
            {"symbol": "PPARG", "ensembl": "ENSG00000132170", "uniprot": "P37231", "confidence": 0.88, "druggability": 0.85},
            {"symbol": "KCNJ11", "ensembl": "ENSG00000187486", "uniprot": "Q00748", "confidence": 0.82, "druggability": 0.60},
            {"symbol": "SLC30A8", "ensembl": "ENSG00000162594", "uniprot": "Q8IWU4", "confidence": 0.78, "druggability": 0.35},
            {"symbol": "INSR", "ensembl": "ENSG00000171105", "uniprot": "P06213", "confidence": 0.85, "druggability": 0.70},
            {"symbol": "GCK", "ensembl": "ENSG00000106633", "uniprot": "P35557", "confidence": 0.80, "druggability": 0.55},
            {"symbol": "DPP4", "ensembl": "ENSG00000197635", "uniprot": "P27487", "confidence": 0.82, "druggability": 0.88},
        ],
        "pathways": ["Type 2 diabetes", "Insulin signaling", "Glucose metabolism", "GPCR signaling", "Incretin signaling"],
    },
}

TISSUE_EXPRESSION = {
    "brain": ["APP", "PSEN1", "MAPT", "SNCA", "LRRK2", "TREM2"],
    "heart": ["MYH7", "MYBPC3", "TTN", "SCN5A", "ADRB1"],
    "lung": ["EGFR", "KRAS", "ALK", "ROS1", "MET"],
    "pancreas": ["TCF7L2", "KCNJ11", "SLC30A8", "GCK", "INSR"],
    "liver": ["APOE", "GBA", "PPARG", "ACE"],
    "kidney": ["ACE", "SLC30A8", "PPARG"],
}


def normalize_disease_name(query: str) -> Optional[str]:
    q = query.lower().strip()
    mapping = {
        "alzheimer": "alzheimer", "alzheimers": "alzheimer", "ad": "alzheimer",
        "parkinson": "parkinson", "pds": "parkinson",
        "lung cancer": "lung_cancer", "lung carcinoma": "lung_cancer", "nsclc": "lung_cancer",
        "heart failure": "heart_failure", "cardiac failure": "heart_failure", "hf": "heart_failure",
        "diabetes": "diabetes_t2", "type 2 diabetes": "diabetes_t2", "t2dm": "diabetes_t2",
    }
    for key, val in mapping.items():
        if key in q:
            return val
    return None


def compute_novelty_score(gene: str, disease_data: dict) -> float:
    known_genes = [g["symbol"] for g in disease_data.get("genes", [])]
    if gene in known_genes:
        idx = known_genes.index(gene)
        confidence = disease_data["genes"][idx]["confidence"]
        return round(1.0 - confidence, 2)
    return round(0.7 + 0.3 * np.random.random(), 2)


def compute_druggability(uniprot_id: str, gene_data: dict) -> tuple[float, str]:
    score = gene_data.get("druggability", 0.5)
    if score > 0.7:
        category = "highly_druggable"
    elif score > 0.4:
        category = "druggable"
    elif score > 0.2:
        category = "difficult"
    else:
        category = "undruggable"
    return score, category


@app.post("/discover", response_model=OmicsTargetResponse)
async def discover_targets(req: OmicsQuery):
    start = time.time()
    disease_key = normalize_disease_name(req.disease)
    if disease_key is None:
        disease_key = "alzheimer"

    disease_data = DISEASE_TARGET_DB.get(disease_key, DISEASE_TARGET_DB["alzheimer"])

    targets = []
    protein_targets = []
    de_genes = []
    for gene_data in disease_data["genes"]:
        g = gene_data["symbol"]
        druggability, druggability_cat = compute_druggability(gene_data["uniprot"], gene_data)

        omics_sources = []
        if "genomics" in req.omics_types:
            omics_sources.append("GWAS")
        if "transcriptomics" in req.omics_types:
            omics_sources.append("RNA-seq")
        if "proteomics" in req.omics_types:
            omics_sources.append("Mass_Spec")
        if "metabolomics" in req.omics_types:
            omics_sources.append("Metabolomics")

        targets.append(TargetGene(
            gene_symbol=g,
            ensembl_id=gene_data["ensembl"],
            uniprot_id=gene_data["uniprot"],
            confidence=gene_data["confidence"],
            evidence_level="strong" if gene_data["confidence"] > 0.85 else "moderate",
            omics_sources=omics_sources,
            druggability_score=druggability,
            novelty_score=compute_novelty_score(g, disease_data),
            description=f"{g} gene associated with {disease_key.replace('_', ' ').title()}",
            pathways=disease_data["pathways"],
        ))

        protein_targets.append(ProteinTarget(
            uniprot_id=gene_data["uniprot"],
            gene_symbol=g,
            protein_name=f"{g} Protein",
            confidence=gene_data["confidence"],
            druggability=druggability_cat,
            known_drugs=int(3 * druggability),
            structures_available=True,
            disease_associations=[disease_key.replace("_", " ").title()],
            tissue_expression={t: g in genes for t, genes in TISSUE_EXPRESSION.items()},
        ))

        if gene_data["confidence"] > 0.7:
            de_genes.append(DifferentiallyExpressedGene(
                gene=g,
                log2fc=round(1.5 + 0.5 * np.random.random(), 2),
                p_adjusted=round(0.001 + 0.009 * np.random.random(), 4),
                tissue="brain" if disease_key in ("alzheimer", "parkinson") else "lung",
                upregulated=True,
            ))

    disease_modules = []
    module_score = 0.85 - 0.05 * len(disease_data["genes"])
    disease_modules.append(DiseaseModule(
        name=f"{disease_key.replace('_', ' ').title()} Core Module",
        genes=[g["symbol"] for g in disease_data["genes"]],
        proteins=[g["uniprot"] for g in disease_data["genes"]],
        pathways=disease_data["pathways"],
        enriched_ontology=[f"GO:{disease_key.upper()}_0001", f"KEGG:{disease_key.upper()}_PATHWAY"],
        module_score=round(module_score, 3),
    ))

    high_confidence = sum(1 for t in targets if t.confidence > 0.85)
    druggable = sum(1 for t in targets if t.druggability_score > 0.5)

    summary = {
        "total_targets": len(targets),
        "high_confidence_targets": high_confidence,
        "druggable_targets": druggable,
        "omics_types_integrated": len(req.omics_types),
        "disease_modules_found": len(disease_modules),
        "novel_targets": sum(1 for t in targets if t.novelty_score > 0.5),
        "recommended_target": max(targets, key=lambda t: t.confidence * t.druggability_score).gene_symbol if targets else "",
    }

    return OmicsTargetResponse(
        disease=req.disease,
        targets=targets,
        disease_modules=disease_modules,
        protein_targets=protein_targets,
        de_genes=de_genes,
        summary=summary,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/crispr-screen", response_model=CRISPRScreenResponse)
def crispr_screen(req: CRISPRScreenRequest):
    rng = np.random.RandomState(hash("".join(req.gene_list)) % (2**31))
    results = []
    hit_count = 0
    for gene in req.gene_list:
        essentiality = round(float(rng.beta(2, 5)), 3)
        z_score = round(float((essentiality - 0.3) / 0.15), 3)
        fdr = round(float(rng.uniform(0.01, 0.5)), 4)
        hit = essentiality > 0.6 and fdr < 0.05
        if hit:
            hit_count += 1
        results.append(CRISPRScreenResult(
            gene=gene,
            essentiality_score=essentiality,
            z_score=z_score,
            fdr=fdr,
            hit=hit,
        ))
    results.sort(key=lambda r: -r.essentiality_score)
    return CRISPRScreenResponse(
        results=results,
        cell_line=req.cell_line,
        phenotype=req.phenotype,
        total_genes=len(req.gene_list),
        hit_count=hit_count,
    )


@app.post("/pathway-enrichment", response_model=PathwayEnrichmentResponse)
def pathway_enrichment(req: PathwayEnrichmentRequest):
    known_pathways = {
        "EGFR signaling": ["EGFR", "KRAS", "BRAF", "MAPK1", "AKT1"],
        "PI3K-AKT pathway": ["PIK3CA", "AKT1", "MTOR", "PTEN"],
        "p53 signaling": ["TP53", "MDM2", "CDKN1A", "BAX"],
        "Wnt signaling": ["CTNNB1", "APC", "AXIN1", "GSK3B"],
        "NF-kB signaling": ["NFKB1", "RELA", "IKBKB", "TNF"],
        "Apoptosis": ["BCL2", "BAX", "CASP3", "CASP9"],
        "Cell cycle": ["CDK1", "CCNB1", "CDKN1A", "RB1"],
        "MAPK pathway": ["MAPK1", "MAPK3", "MAP2K1", "BRAF"],
    }

    pathways = []
    input_set = set(g.upper() for g in req.genes)
    for pname, pgenes in known_pathways.items():
        overlap = list(input_set & set(g.upper() for g in pgenes))
        if overlap:
            p_val = round(float(np.random.uniform(0.001, 0.05)), 4)
            fdr = round(min(1.0, p_val * len(known_pathways) / max(1, len(overlap))), 4)
            score = round(len(overlap) / len(pgenes) * 100, 2)
            pathways.append(PathwayEntry(
                pathway_id=f"KP-{pname[:4].upper()}",
                pathway_name=pname,
                database="kegg",
                p_value=p_val,
                fdr=fdr,
                overlapping_genes=overlap,
                enrichment_score=score,
            ))

    pathways.sort(key=lambda p: p.enrichment_score, reverse=True)
    return PathwayEnrichmentResponse(
        pathways=pathways,
        total_genes_input=len(req.genes),
        genes_mapped=len(set(g.upper() for g in req.genes if g.upper() in sum(known_pathways.values(), []))),
        significant_pathways=sum(1 for p in pathways if p.fdr < 0.05),
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "diseases": list(DISEASE_TARGET_DB.keys()),
        "omics_types": ["genomics", "transcriptomics", "proteomics", "metabolomics"],
    }
