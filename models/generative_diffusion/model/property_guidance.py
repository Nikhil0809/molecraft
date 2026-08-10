import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Dict, List, Tuple
import asyncio
import httpx
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors


class PropertyGuidanceHead(nn.Module):
    def __init__(self, hidden_dim: int = 256, num_properties: int = 6):
        super().__init__()
        self.num_properties = num_properties
        
        self.shared = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
        )
        
        self.heads = nn.ModuleDict({
            'affinity': nn.Linear(hidden_dim, 1),
            'qed': nn.Linear(hidden_dim, 1),
            'sa_score': nn.Linear(hidden_dim, 1),
            'logp': nn.Linear(hidden_dim, 1),
            'mw': nn.Linear(hidden_dim, 1),
            'hbd': nn.Linear(hidden_dim, 1),
            'hba': nn.Linear(hidden_dim, 1),
            'tpsa': nn.Linear(hidden_dim, 1),
            'rotatable_bonds': nn.Linear(hidden_dim, 1),
        })
    
    def forward(self, mol_embedding: torch.Tensor) -> Dict[str, torch.Tensor]:
        shared = self.shared(mol_embedding)
        return {name: head(shared) for name, head in self.heads.items()}


class GradientGuidance:
    def __init__(self, model: nn.Module, property_weights: Dict[str, float]):
        self.model = model
        self.property_weights = property_weights
        
    def compute_guidance(self, h: torch.Tensor, pos: torch.Tensor, 
                         targets: Dict[str, torch.Tensor]) -> Tuple[torch.Tensor, torch.Tensor]:
        h.requires_grad_(True)
        pos.requires_grad_(True)
        
        props = self.model.property_predictor(h)
        
        loss = 0
        for i, (name, target) in enumerate(targets.items()):
            if name in self.property_weights:
                pred = props[:, i]
                weight = self.property_weights[name]
                loss += weight * F.mse_loss(pred, target)
        
        h_grad = torch.autograd.grad(loss, h, retain_graph=True)[0]
        pos_grad = torch.autograd.grad(loss, pos, retain_graph=True)[0]
        
        return h_grad, pos_grad


class RDKitPropertyCalculator:
    @staticmethod
    def calculate_all(smiles: str) -> Dict[str, float]:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return {}
        
        mol = Chem.AddHs(mol)
        try:
            AllChem.EmbedMolecule(mol, AllChem.ETKDG())
            AllChem.MMFFOptimizeMolecule(mol)
        except Exception:
            pass
        
        return {
            'mw': Descriptors.MolWt(mol),
            'logp': Descriptors.MolLogP(mol),
            'qed': Descriptors.qed(mol),
            'hbd': Descriptors.NumHDonors(mol),
            'hba': Descriptors.NumHAcceptors(mol),
            'tpsa': Descriptors.TPSA(mol),
            'rotatable_bonds': Descriptors.NumRotatableBonds(mol),
            'sa_score': RDKitPropertyCalculator._calc_sa_score(mol),
        }
    
    @staticmethod
    def _calc_sa_score(mol: Chem.Mol) -> float:
        mw = Descriptors.MolWt(mol)
        logp = Descriptors.MolLogP(mol)
        hbd = Descriptors.NumHDonors(mol)
        hba = Descriptors.NumHAcceptors(mol)
        rot = Descriptors.NumRotatableBonds(mol)
        n_aromatic = Descriptors.NumAromaticRings(mol)
        ring_count = Descriptors.RingCount(mol)
        n_hetero = Descriptors.NumHeteroatoms(mol)
        chiral_centers = len(Chem.FindMolChiralCenters(mol, includeUnassigned=True))
        
        complexity = 0.0
        complexity += min(mw / 100.0, 10.0)
        complexity += ring_count * 1.5
        complexity += n_hetero * 0.5
        complexity += chiral_centers * 1.0
        complexity += abs(logp - 2.5) * 0.3
        complexity += max(0, rot - 5) * 0.5
        complexity += n_aromatic * 0.8
        complexity += max(0, hbd - 2) * 0.4
        complexity += max(0, hba - 4) * 0.3
        
        normalized = min(complexity / 12.0, 1.0)
        sa = 1.0 + normalized * 9.0
        return round(sa, 2)


class UnifiedPredictorClient:
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def predict_batch(self, smiles_list: List[str]) -> List[Dict]:
        try:
            resp = await self.client.post(
                f"{self.base_url}/predict_batch",
                json={"smiles": smiles_list, "tasks": None, "return_uncertainty": True}
            )
            if resp.status_code == 200:
                return resp.json().get("results", [])
        except Exception:
            pass
        return [{} for _ in smiles_list]
    
    async def close(self):
        await self.client.aclose()


class PropertyGuidedSampler:
    def __init__(
        self,
        diffusion_model,
        property_predictor: nn.Module,
        unified_client: Optional[UnifiedPredictorClient] = None,
        guidance_scale: float = 3.0,
        property_weights: Optional[Dict[str, float]] = None
    ):
        self.diffusion_model = diffusion_model
        self.property_predictor = property_predictor
        self.unified_client = unified_client
        self.guidance_scale = guidance_scale
        self.property_weights = property_weights or {
            'affinity': 1.0,
            'qed': 0.5,
            'sa_score': -0.5,
            'logp': 0.2,
        }
    
    @torch.no_grad()
    def sample_with_guidance(
        self,
        pocket_features: torch.Tensor,
        pocket_pos: torch.Tensor,
        pocket_edge_index: torch.Tensor,
        n_samples: int = 100,
        n_steps: int = 100,
        targets: Optional[Dict] = None,
        device: str = 'cuda'
    ) -> List[Dict]:
        batch_size = n_samples
        max_atoms = self.diffusion_model.max_atoms
        
        atom_types = torch.randint(0, self.diffusion_model.atom_types, (batch_size, max_atoms), device=device)
        charges = torch.zeros(batch_size, max_atoms, dtype=torch.long, device=device)
        pos = torch.randn(batch_size, max_atoms, 3, device=device)
        
        ligand_edge_index = self._create_ligand_edges(max_atoms, batch_size, device)
        
        for step in range(n_steps - 1, -1, -1):
            t = torch.full((batch_size,), step, device=device, dtype=torch.long)
            
            atom_logits, charge_logits, pos_pred, bond_logits = self.diffusion_model(
                atom_types, charges, pos, t,
                pocket_features, pocket_pos, pocket_edge_index, ligand_edge_index
            )
            
            if targets and step % 5 == 0:
                h = self.diffusion_model.atom_type_embedding(atom_types) + \
                    self.diffusion_model.atom_charge_embedding(charges)
                h = h + self.diffusion_model._get_time_embedding(t).unsqueeze(1)
                
                for layer, norm in zip(self.diffusion_model.diffusion_layers, self.diffusion_model.norm_layers):
                    h = h + layer(h, pos, ligand_edge_index)
                    h = norm(h)
                
                mol_emb = h.mean(dim=1)
                props = self.property_predictor(mol_emb)
                
                grad_scale = self.guidance_scale * (step / n_steps)
                for name, target_val in targets.items():
                    if name in self.property_weights:
                        idx = list(self.property_weights.keys()).index(name)
                        weight = self.property_weights[name]
                        pred = props[:, idx]
                        grad = torch.autograd.grad((pred - target_val).pow(2).mean(), pos, retain_graph=True)[0]
                        pos = pos - grad_scale * weight * grad
            
            pos = pos + pos_pred * 0.1
            
            atom_probs = F.softmax(atom_logits, dim=-1)
            atom_types = torch.multinomial(atom_probs.view(-1, atom_probs.size(-1)), 1).view(batch_size, max_atoms)
            
            charge_probs = F.softmax(charge_logits, dim=-1)
            charges = torch.multinomial(charge_probs.view(-1, charge_probs.size(-1)), 1).view(batch_size, max_atoms)
        
        return self._decode_molecules(atom_types, charges, pos, bond_logits, ligand_edge_index)
    
    def _create_ligand_edges(self, max_atoms: int, batch_size: int, device: str) -> torch.Tensor:
        edges = []
        for i in range(max_atoms - 1):
            edges.append([i, i + 1])
            edges.append([i + 1, i])
        edge_index = torch.tensor(edges, dtype=torch.long, device=device).t()
        edge_index = edge_index.repeat(1, batch_size)
        offset = torch.arange(batch_size, device=device) * max_atoms
        edge_index = edge_index + offset.repeat_interleave(edge_index.size(1) // batch_size)
        return edge_index
    
    def _decode_molecules(self, atom_types, charges, pos, bond_logits, edge_index):
        molecules = []
        batch_size = atom_types.shape[0]
        
        for b in range(batch_size):
            mask = atom_types[b] != 0
            if not mask.any():
                continue
            
            atoms = atom_types[b][mask].cpu().numpy()
            coords = pos[b][mask].cpu().numpy()
            
            mol = Chem.RWMol()
            atom_map = {}
            for i, at in enumerate(atoms):
                symbol = self._idx_to_atom(int(at))
                if symbol:
                    idx = mol.AddAtom(Chem.Atom(symbol))
                    atom_map[i] = idx
            
            if bond_logits is not None and edge_index is not None:
                src, dst = edge_index
                for i in range(src.size(0)):
                    s, d = src[i].item(), dst[i].item()
                    if s in atom_map and d in atom_map:
                        bond_type = bond_logits[b, i].argmax().item()
                        if bond_type > 0:
                            bt = [Chem.BondType.SINGLE, Chem.BondType.DOUBLE, 
                                  Chem.BondType.TRIPLE, Chem.BondType.AROMATIC][bond_type - 1]
                            mol.AddBond(atom_map[s], atom_map[d], bt)
            
            try:
                mol = mol.GetMol()
                smiles = Chem.MolToSmiles(mol)
                if smiles and '.' not in smiles:
                    molecules.append({
                        'smiles': smiles,
                        'coords': coords.tolist(),
                        'atom_types': atoms.tolist()
                    })
            except Exception:
                continue
        
        return molecules
    
    def _idx_to_atom(self, idx: int) -> str:
        mapping = {0: 'C', 1: 'N', 2: 'O', 3: 'S', 4: 'P', 5: 'F', 6: 'Cl', 7: 'Br', 8: 'I'}
        return mapping.get(idx, 'C')