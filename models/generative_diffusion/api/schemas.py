from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Literal
from enum import Enum


class ADMETConstraints(BaseModel):
    max_logp: Optional[float] = Field(default=5.0, ge=0, le=10)
    min_qed: Optional[float] = Field(default=0.3, ge=0, le=1)
    max_sa_score: Optional[float] = Field(default=4.0, ge=1, le=10)
    max_mw: Optional[float] = Field(default=500, ge=100, le=1000)
    max_hbd: Optional[int] = Field(default=5, ge=0, le=10)
    max_hba: Optional[int] = Field(default=10, ge=0, le=20)
    max_tpsa: Optional[float] = Field(default=140, ge=0, le=300)
    max_rotatable: Optional[int] = Field(default=10, ge=0, le=30)
    no_alerts: bool = False


class PocketSpecification(BaseModel):
    target_uniprot: Optional[str] = None
    target_pdb: Optional[str] = None
    pocket_residues: Optional[List[str]] = None
    pocket_center: Optional[List[float]] = None
    pocket_radius: float = Field(default=10.0, ge=5, le=20)


class GenerateRequest(BaseModel):
    pocket: PocketSpecification
    
    n_samples: int = Field(default=100, ge=10, le=500)
    n_final: int = Field(default=20, ge=1, le=100)
    
    affinity_target_nm: Optional[float] = Field(default=None, ge=0.01, le=10000)
    admet_constraints: Optional[ADMETConstraints] = None
    sa_threshold: float = Field(default=4.0, ge=1.0, le=10.0)
    qed_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    
    apply_synthesis_filter: bool = True
    apply_ip_filter: bool = True
    ip_patent_db: Literal["uspto", "epo", "wipo", "all", "custom"] = "uspto"
    ip_similarity_threshold: float = Field(default=0.8, ge=0.5, le=0.95)
    
    guidance_scale: float = Field(default=3.0, ge=1.0, le=10.0)
    sampling_steps: int = Field(default=50, ge=10, le=200)
    sampler_type: Literal["ddim", "ddpm"] = "ddim"
    
    temperature: float = Field(default=1.0, ge=0.1, le=2.0)
    seed: Optional[int] = None


class GenerationResult(BaseModel):
    smiles: str
    coords: Optional[List[List[float]]] = None
    atom_types: Optional[List[int]] = None
    properties: Dict[str, float]
    sa_score: float
    synthesis_routes: Optional[List[Dict]] = None
    best_route_score: Optional[float] = None
    ip_risk: str
    ip_details: Dict
    validation_method: str = "diffusion_generation"


class GenerateResponse(BaseModel):
    request_id: str
    pocket: PocketSpecification
    generated: int
    filtered: int
    results: List[GenerationResult]
    status: str
    inference_time_ms: float


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
    device: str
    checkpoint: Optional[str] = None