import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple, List, Dict
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem
import requests
import os


AA_TO_IDX = {
    'ALA': 0, 'ARG': 1, 'ASN': 2, 'ASP': 3, 'CYS': 4,
    'GLN': 5, 'GLU': 6, 'GLY': 7, 'HIS': 8, 'ILE': 9,
    'LEU': 10, 'LYS': 11, 'MET': 12, 'PHE': 13, 'PRO': 14,
    'SER': 15, 'THR': 16, 'TRP': 17, 'TYR': 18, 'VAL': 19,
    'UNK': 20
}

ATOM_TO_IDX = {
    'C': 0, 'N': 1, 'O': 2, 'S': 3, 'P': 4, 'SE': 5,
    'FE': 6, 'ZN': 7, 'MG': 8, 'CA': 9, 'CL': 10, 'BR': 11,
    'I': 12, 'F': 13, 'B': 14, 'SI': 15, 'UNK': 16
}


def parse_pdb_to_graph(pdb_path: str, binding_site_residues: Optional[List[str]] = None) -> Tuple:
    coords = []
    atom_types = []
    residues = []
    residue_ids = []
    
    with open(pdb_path, 'r') as f:
        for line in f:
            if line.startswith('ATOM') or line.startswith('HETATM'):
                atom_name = line[12:16].strip()
                residue_name = line[17:20].strip()
                chain_id = line[21]
                residue_seq = int(line[22:26])
                x = float(line[30:38])
                y = float(line[38:46])
                z = float(line[46:54])
                element = line[76:78].strip()
                
                if element == 'H':
                    continue
                
                residue_key = f"{chain_id}{residue_seq}{residue_name}"
                if binding_site_residues and residue_key not in binding_site_residues:
                    continue
                
                coords.append([x, y, z])
                atom_types.append(ATOM_TO_IDX.get(element.upper(), ATOM_TO_IDX['UNK']))
                residues.append(AA_TO_IDX.get(residue_name, AA_TO_IDX['UNK']))
                residue_ids.append(residue_key)
    
    coords = torch.tensor(coords, dtype=torch.float32)
    atom_types = torch.tensor(atom_types, dtype=torch.long)
    residues = torch.tensor(residues, dtype=torch.long)
    
    dist = torch.cdist(coords, coords)
    edge_index = (dist < 5.0).nonzero().t()
    edge_index = edge_index[:, edge_index[0] != edge_index[1]]
    
    return coords, atom_types, residues, edge_index, residue_ids


def fetch_alphafold_structure(uniprot_id: str, save_path: str) -> bool:
    url = f"https://alphafold.ebi.ac.uk/files/AF-{uniprot_id}-F1-model_v4.pdb"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            with open(save_path, 'w') as f:
                f.write(response.text)
            return True
    except Exception:
        pass
    return False


def detect_binding_pocket(pocket_coords: torch.Tensor, ligand_coords: Optional[torch.Tensor] = None) -> List[int]:
    if ligand_coords is not None:
        dist = torch.cdist(pocket_coords, ligand_coords)
        min_dist = dist.min(dim=1)[0]
        pocket_residues = (min_dist < 6.0).nonzero().squeeze(-1).tolist()
    else:
        center = pocket_coords.mean(dim=0)
        dist = torch.norm(pocket_coords - center, dim=-1)
        pocket_residues = (dist < 15.0).nonzero().squeeze(-1).tolist()
    return pocket_residues


class PocketFeaturizer:
    def __init__(self, max_residues: int = 500):
        self.max_residues = max_residues
    
    def featurize(self, pdb_path: str, binding_site_residues: Optional[List[str]] = None) -> Dict:
        coords, atom_types, residues, edge_index, residue_ids = parse_pdb_to_graph(
            pdb_path, binding_site_residues
        )
        
        if len(residue_ids) > self.max_residues:
            keep_idx = torch.randperm(len(residue_ids))[:self.max_residues]
            coords = coords[keep_idx]
            atom_types = atom_types[keep_idx]
            residues = residues[keep_idx]
            residue_ids = [residue_ids[i] for i in keep_idx]
            mask = (edge_index[0].unsqueeze(1) == keep_idx.unsqueeze(0)).any(1) & \
                   (edge_index[1].unsqueeze(1) == keep_idx.unsqueeze(0)).any(1)
            edge_index = edge_index[:, mask]
        
        return {
            'coords': coords,
            'atom_types': atom_types,
            'residues': residues,
            'edge_index': edge_index,
            'residue_ids': residue_ids
        }
    
    def featurize_from_uniprot(self, uniprot_id: str, cache_dir: str = './pdb_cache') -> Dict:
        os.makedirs(cache_dir, exist_ok=True)
        pdb_path = os.path.join(cache_dir, f"{uniprot_id}.pdb")
        
        if not os.path.exists(pdb_path):
            fetch_alphafold_structure(uniprot_id, pdb_path)
        
        return self.featurize(pdb_path)


def get_pocket_center(pocket_data: Dict) -> torch.Tensor:
    return pocket_data['coords'].mean(dim=0)


def get_pocket_bbox(pocket_data: Dict, margin: float = 5.0) -> Tuple[torch.Tensor, torch.Tensor]:
    coords = pocket_data['coords']
    min_coords = coords.min(dim=0)[0] - margin
    max_coords = coords.max(dim=0)[0] + margin
    return min_coords, max_coords