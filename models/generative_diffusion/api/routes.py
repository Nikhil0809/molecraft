import time
import uuid
import asyncio
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from .schemas import GenerateRequest, GenerateResponse, GenerationResult, HealthResponse

from ..model.diffusion import MolDiffModel, load_pretrained_moldiff
from ..model.pocket_encoder import PocketFeaturizer, fetch_alphafold_structure, get_pocket_center
from ..model.property_guidance import PropertyGuidanceHead, UnifiedPredictorClient, PropertyGuidedSampler
from ..inference.sampler import GuidedSampler
from ..inference.synthesis_filter import SynthesisFilter
from ..inference.ip_filter import IPFilter

import torch


router = APIRouter()

_model: Optional[MolDiffModel] = None
_property_predictor: Optional[PropertyGuidanceHead] = None
_sampler: Optional[GuidedSampler] = None
_synthesis_filter: Optional[SynthesisFilter] = None
_ip_filter: Optional[IPFilter] = None
_pocket_featurizer: Optional[PocketFeaturizer] = None
_unified_client: Optional[UnifiedPredictorClient] = None
_device: str = "cuda" if torch.cuda.is_available() else "cpu"
_model_loaded: bool = False


async def initialize_model(
    checkpoint_path: str = "./model/checkpoints/moldiff.pt",
    property_checkpoint: str = "./model/checkpoints/property_head.pt",
    patent_db_path: Optional[str] = None,
    unified_predictor_url: str = "http://localhost:8001"
):
    global _model, _property_predictor, _sampler, _synthesis_filter, _ip_filter
    global _pocket_featurizer, _unified_client, _model_loaded, _device
    
    try:
        _model = load_pretrained_moldiff(checkpoint_path, _device)
        
        _property_predictor = PropertyGuidanceHead(hidden_dim=_model.hidden_dim)
        if property_checkpoint and torch.cuda.is_available():
            _property_predictor.load_state_dict(torch.load(property_checkpoint, map_location=_device))
        _property_predictor.to(_device)
        _property_predictor.eval()
        
        _unified_client = UnifiedPredictorClient(unified_predictor_url)
        
        _sampler = GuidedSampler(
            diffusion_model=_model,
            property_predictor=_property_predictor,
            unified_client=_unified_client,
            guidance_scale=3.0,
            device=_device
        )
        
        _synthesis_filter = SynthesisFilter(use_local=True, max_sa_score=5.0)
        _ip_filter = IPFilter(patent_db_path=patent_db_path, similarity_threshold=0.8)
        
        _pocket_featurizer = PocketFeaturizer()
        
        _model_loaded = True
        print("Generative diffusion model loaded successfully")
    except Exception as e:
        print(f"Failed to load model: {e}")
        _model_loaded = False


@router.post("/generate", response_model=GenerateResponse)
async def generate_molecules(request: GenerateRequest):
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if request.seed is not None:
        torch.manual_seed(request.seed)
    
    try:
        pocket_data = await _prepare_pocket(request.pocket)
        
        targets = {}
        if request.affinity_target_nm:
            targets['affinity'] = torch.tensor([request.affinity_target_nm], device=_device)
        if request.admet_constraints:
            if request.admet_constraints.min_qed:
                targets['qed'] = torch.tensor([request.admet_constraints.min_qed], device=_device)
            if request.admet_constraints.max_sa_score:
                targets['sa_score'] = torch.tensor([request.admet_constraints.max_sa_score], device=_device)
        
        raw_molecules = _sampler.sample(
            pocket_features=pocket_data['features'],
            pocket_pos=pocket_data['coords'],
            pocket_edge_index=pocket_data['edge_index'],
            n_samples=request.n_samples,
            n_steps=request.sampling_steps,
            targets=targets if targets else None
        )
        
        filtered = raw_molecules
        
        if request.apply_synthesis_filter:
            filtered = await _synthesis_filter.filter_batch(filtered)
        
        if request.apply_ip_filter:
            filtered = _ip_filter.filter_batch(filtered)
        
        if request.admet_constraints:
            filtered = _apply_admet_filter(filtered, request.admet_constraints)
        
        filtered = [m for m in filtered if m.get('properties', {}).get('sa_score', 10) <= request.sa_threshold]
        filtered = [m for m in filtered if m.get('properties', {}).get('qed', 0) >= request.qed_threshold]
        
        filtered = filtered[:request.n_final]
        
        results = []
        for mol in filtered:
            results.append(GenerationResult(
                smiles=mol['smiles'],
                coords=mol.get('coords'),
                atom_types=mol.get('atom_types'),
                properties=mol.get('properties', {}),
                sa_score=mol.get('sa_score', 0),
                synthesis_routes=mol.get('synthesis_routes'),
                best_route_score=mol.get('best_route_score'),
                ip_risk=mol.get('ip_risk', 'unknown'),
                ip_details=mol.get('ip_details', {})
            ))
        
        return GenerateResponse(
            request_id=request_id,
            pocket=request.pocket,
            generated=len(raw_molecules),
            filtered=len(results),
            results=results,
            status="completed",
            inference_time_ms=round((time.time() - start_time) * 1000, 1)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


async def _prepare_pocket(pocket_spec) -> Dict:
    if pocket_spec.target_uniprot:
        pocket_data = _pocket_featurizer.featurize_from_uniprot(pocket_spec.target_uniprot)
    elif pocket_spec.target_pdb:
        pocket_data = _pocket_featurizer.featurize(pocket_spec.target_pdb, pocket_spec.pocket_residues)
    else:
        raise ValueError("Either target_uniprot or target_pdb must be provided")
    
    if pocket_spec.pocket_center:
        center = torch.tensor(pocket_spec.pocket_center, dtype=torch.float32)
    else:
        center = get_pocket_center(pocket_data)
    
    mask = torch.norm(pocket_data['coords'] - center, dim=-1) < pocket_spec.pocket_radius
    pocket_data['coords'] = pocket_data['coords'][mask]
    pocket_data['atom_types'] = pocket_data['atom_types'][mask]
    pocket_data['residues'] = pocket_data['residues'][mask]
    
    pocket_coords = pocket_data['coords'].unsqueeze(0).to(_device)
    pocket_atoms = pocket_data['atom_types'].unsqueeze(0).to(_device)
    pocket_residues = pocket_data['residues'].unsqueeze(0).to(_device)
    pocket_edge_index = pocket_data['edge_index'].to(_device)
    
    with torch.no_grad():
        pocket_features, _ = _model.pocket_encoder(
            pocket_atoms, pocket_coords, pocket_residues, pocket_edge_index
        )
    
    return {
        'features': pocket_features,
        'coords': pocket_coords,
        'edge_index': pocket_edge_index
    }


def _apply_admet_filter(molecules: List[Dict], constraints) -> List[Dict]:
    filtered = []
    for mol in molecules:
        props = mol.get('properties', {})
        if constraints.max_logp and props.get('logp', 0) > constraints.max_logp:
            continue
        if constraints.min_qed and props.get('qed', 0) < constraints.min_qed:
            continue
        if constraints.max_sa_score and props.get('sa_score', 10) > constraints.max_sa_score:
            continue
        if constraints.max_mw and props.get('mw', 0) > constraints.max_mw:
            continue
        if constraints.max_hbd and props.get('hbd', 0) > constraints.max_hbd:
            continue
        if constraints.max_hba and props.get('hba', 0) > constraints.max_hba:
            continue
        if constraints.max_tpsa and props.get('tpsa', 0) > constraints.max_tpsa:
            continue
        if constraints.max_rotatable and props.get('rotatable_bonds', 0) > constraints.max_rotatable:
            continue
        filtered.append(mol)
    return filtered


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok" if _model_loaded else "loading",
        model_loaded=_model_loaded,
        model_version="1.0.0",
        device=_device,
        checkpoint="./model/checkpoints/moldiff.pt" if _model_loaded else None
    )


@router.post("/generate/stream")
async def generate_stream(request: GenerateRequest):
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    async def event_generator():
        pocket_data = await _prepare_pocket(request.pocket)
        
        targets = {}
        if request.affinity_target_nm:
            targets['affinity'] = torch.tensor([request.affinity_target_nm], device=_device)
        
        n_batches = request.n_samples // 20
        for batch_idx in range(n_batches):
            raw_molecules = _sampler.sample(
                pocket_features=pocket_data['features'],
                pocket_pos=pocket_data['coords'],
                pocket_edge_index=pocket_data['edge_index'],
                n_samples=min(20, request.n_samples - batch_idx * 20),
                n_steps=request.sampling_steps,
                targets=targets
            )
            
            if request.apply_synthesis_filter:
                raw_molecules = await _synthesis_filter.filter_batch(raw_molecules)
            
            if request.apply_ip_filter:
                raw_molecules = _ip_filter.filter_batch(raw_molecules)
            
            for mol in raw_molecules:
                yield f"data: {mol}\n\n"
            
            await asyncio.sleep(0.01)
        
        yield "data: [DONE]\n\n"
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(event_generator(), media_type="text/event-stream")