import torch
import torch.nn.functional as F
from typing import Optional, List, Dict, Tuple
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem, rdMolDescriptors
from tqdm import tqdm
import math


class DDPMSampler:
    def __init__(self, model, timesteps: int = 1000, device: str = 'cuda'):
        self.model = model
        self.timesteps = timesteps
        self.device = device
        
        betas = model.betas
        alphas = model.alphas
        alphas_cumprod = model.alphas_cumprod
        
        self.register_buffer('betas', betas)
        self.register_buffer('alphas', alphas)
        self.register_buffer('alphas_cumprod', alphas_cumprod)
        self.register_buffer('sqrt_alphas_cumprod', torch.sqrt(alphas_cumprod))
        self.register_buffer('sqrt_one_minus_alphas_cumprod', torch.sqrt(1. - alphas_cumprod))
        self.register_buffer('sqrt_recip_alphas', torch.sqrt(1. / alphas))
        self.register_buffer('posterior_variance', betas * (1. - alphas_cumprod[:-1]) / (1. - alphas_cumprod))
    
    def register_buffer(self, name: str, tensor: torch.Tensor):
        setattr(self, name, tensor.to(self.device))
    
    @torch.no_grad()
    def p_sample(self, x: torch.Tensor, t: torch.Tensor, **model_kwargs) -> torch.Tensor:
        model_output = self.model(x, t, **model_kwargs)
        
        pred_noise = model_output
        
        sqrt_recip_alphas_t = self.sqrt_recip_alphas[t].view(-1, 1, 1)
        sqrt_one_minus_alphas_cumprod_t = self.sqrt_one_minus_alphas_cumprod[t].view(-1, 1, 1)
        
        pred_x0 = sqrt_recip_alphas_t * (x - sqrt_one_minus_alphas_cumprod_t * pred_noise)
        
        if t[0] == 0:
            return pred_x0
        
        posterior_var = self.posterior_variance[t].view(-1, 1, 1)
        noise = torch.randn_like(x)
        return pred_x0 + torch.sqrt(posterior_var) * noise
    
    @torch.no_grad()
    def sample_loop(self, shape: Tuple, **model_kwargs) -> torch.Tensor:
        x = torch.randn(shape, device=self.device)
        
        for i in tqdm(reversed(range(self.timesteps)), desc="Sampling", total=self.timesteps):
            t = torch.full((shape[0],), i, device=self.device, dtype=torch.long)
            x = self.p_sample(x, t, **model_kwargs)
        
        return x


class DDIMsampler:
    def __init__(self, model, timesteps: int = 1000, eta: float = 0.0, device: str = 'cuda'):
        self.model = model
        self.timesteps = timesteps
        self.eta = eta
        self.device = device
        
        alphas_cumprod = model.alphas_cumprod
        self.register_buffer('alphas_cumprod', alphas_cumprod)
        self.register_buffer('sqrt_alphas_cumprod', torch.sqrt(alphas_cumprod))
        self.register_buffer('sqrt_one_minus_alphas_cumprod', torch.sqrt(1. - alphas_cumprod))
    
    def register_buffer(self, name: str, tensor: torch.Tensor):
        setattr(self, name, tensor.to(self.device))
    
    @torch.no_grad()
    def sample(self, shape: Tuple, steps: int = 50, **model_kwargs) -> torch.Tensor:
        x = torch.randn(shape, device=self.device)
        
        seq = list(range(0, self.timesteps, self.timesteps // steps))
        seq_next = [-1] + seq[:-1]
        
        for i, j in tqdm(zip(reversed(seq), reversed(seq_next)), desc="DDIM Sampling", total=len(seq)):
            t = torch.full((shape[0],), i, device=self.device, dtype=torch.long)
            next_t = torch.full((shape[0],), j, device=self.device, dtype=torch.long)
            
            alpha_t = self.sqrt_alphas_cumprod[t].view(-1, 1, 1)
            alpha_next = self.sqrt_alphas_cumprod[next_t].view(-1, 1, 1)
            sigma = self.eta * torch.sqrt((1 - alpha_next**2) / (1 - alpha_t**2) * (1 - alpha_t**2 / alpha_next**2))
            
            pred_noise = self.model(x, t, **model_kwargs)
            pred_x0 = (x - self.sqrt_one_minus_alphas_cumprod[t].view(-1, 1, 1) * pred_noise) / alpha_t
            
            dir_xt = torch.sqrt(1 - alpha_next**2 - sigma**2) * pred_noise
            noise = torch.randn_like(x) if j >= 0 else 0
            
            x = alpha_next * pred_x0 + dir_xt + sigma * noise
        
        return x


class GuidedSampler:
    def __init__(
        self,
        diffusion_model,
        property_predictor,
        unified_client=None,
        sampler_type: str = 'ddim',
        guidance_scale: float = 3.0,
        property_weights: Optional[Dict[str, float]] = None,
        device: str = 'cuda'
    ):
        self.diffusion_model = diffusion_model
        self.property_predictor = property_predictor
        self.unified_client = unified_client
        self.guidance_scale = guidance_scale
        self.property_weights = property_weights or {
            'affinity': 1.0,
            'qed': 0.5,
            'sa_score': -0.5,
        }
        self.device = device
        
        if sampler_type == 'ddim':
            self.sampler = DDIMsampler(diffusion_model, device=device)
        else:
            self.sampler = DDPMSampler(diffusion_model, device=device)
    
    @torch.no_grad()
    def sample(
        self,
        pocket_features: torch.Tensor,
        pocket_pos: torch.Tensor,
        pocket_edge_index: torch.Tensor,
        n_samples: int = 100,
        n_steps: int = 50,
        targets: Optional[Dict] = None,
        ligand_edge_index: Optional[torch.Tensor] = None
    ) -> List[Dict]:
        batch_size = n_samples
        max_atoms = self.diffusion_model.max_atoms
        
        atom_types = torch.randint(0, self.diffusion_model.atom_types, (batch_size, max_atoms), device=self.device)
        charges = torch.zeros(batch_size, max_atoms, dtype=torch.long, device=self.device)
        pos = torch.randn(batch_size, max_atoms, 3, device=self.device)
        
        if ligand_edge_index is None:
            ligand_edge_index = self._create_ligand_edges(max_atoms, batch_size)
        
        for step_idx in range(n_steps):
            step = self.timesteps - 1 - step_idx * (self.timesteps // n_steps)
            t = torch.full((batch_size,), step, device=self.device, dtype=torch.long)
            
            atom_logits, charge_logits, pos_pred, bond_logits = self.diffusion_model(
                atom_types, charges, pos, t,
                pocket_features, pocket_pos, pocket_edge_index, ligand_edge_index
            )
            
            if targets and step_idx % 3 == 0:
                pos = self._apply_guidance(
                    atom_types, charges, pos, t,
                    pocket_features, pocket_pos, pocket_edge_index,
                    ligand_edge_index, targets
                )
            
            pos = pos + pos_pred * 0.1
            
            atom_probs = F.softmax(atom_logits, dim=-1)
            atom_types = torch.multinomial(atom_probs.view(-1, atom_probs.size(-1)), 1).view(batch_size, max_atoms)
            
            charge_probs = F.softmax(charge_logits, dim=-1)
            charges = torch.multinomial(charge_probs.view(-1, charge_probs.size(-1)), 1).view(batch_size, max_atoms)
        
        return self._decode_batch(atom_types, charges, pos, bond_logits, ligand_edge_index, batch_size)
    
    def _apply_guidance(self, atom_types, charges, pos, t, pocket_features, pocket_pos, 
                        pocket_edge_index, ligand_edge_index, targets):
        pos.requires_grad_(True)
        
        atom_logits, charge_logits, pos_pred, bond_logits = self.diffusion_model(
            atom_types, charges, pos, t,
            pocket_features, pocket_pos, pocket_edge_index, ligand_edge_index
        )
        
        h = self.diffusion_model.atom_type_embedding(atom_types) + \
            self.diffusion_model.atom_charge_embedding(charges)
        h = h + self.diffusion_model._get_time_embedding(t).unsqueeze(1)
        
        for layer, norm in zip(self.diffusion_model.diffusion_layers, self.diffusion_model.norm_layers):
            h = h + layer(h, pos, ligand_edge_index)
            h = norm(h)
        
        mol_emb = h.mean(dim=1)
        props = self.property_predictor(mol_emb)
        
        loss = 0
        prop_names = list(self.property_weights.keys())
        for i, name in enumerate(prop_names):
            if name in targets:
                weight = self.property_weights[name]
                target = targets[name]
                pred = props[:, i]
                loss += weight * F.mse_loss(pred, target.expand_as(pred))
        
        pos_grad = torch.autograd.grad(loss, pos, retain_graph=True)[0]
        
        return pos.detach() - self.guidance_scale * pos_grad
    
    def _create_ligand_edges(self, max_atoms: int, batch_size: int) -> torch.Tensor:
        edges = []
        for i in range(max_atoms - 1):
            edges.append([i, i + 1])
            edges.append([i + 1, i])
        edge_index = torch.tensor(edges, dtype=torch.long, device=self.device).t()
        edge_index = edge_index.repeat(1, batch_size)
        offset = torch.arange(batch_size, device=self.device) * max_atoms
        edge_index = edge_index + offset.repeat_interleave(edge_index.size(1) // batch_size)
        return edge_index
    
    def _decode_batch(self, atom_types, charges, pos, bond_logits, edge_index, batch_size):
        molecules = []
        
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
                    prop_dict = self._calculate_properties(mol)
                    molecules.append({
                        'smiles': smiles,
                        'coords': coords.tolist(),
                        'atom_types': atoms.tolist(),
                        'properties': prop_dict
                    })
            except Exception:
                continue
        
        return molecules
    
    def _idx_to_atom(self, idx: int) -> str:
        mapping = {0: 'C', 1: 'N', 2: 'O', 3: 'S', 4: 'P', 5: 'F', 6: 'Cl', 7: 'Br', 8: 'I'}
        return mapping.get(idx, 'C')
    
    def _calculate_properties(self, mol: Chem.Mol) -> Dict:
        from rdkit.Chem import Descriptors
        return {
            'mw': Descriptors.MolWt(mol),
            'logp': Descriptors.MolLogP(mol),
            'qed': Descriptors.qed(mol),
            'hbd': Descriptors.NumHDonors(mol),
            'hba': Descriptors.NumHAcceptors(mol),
            'tpsa': Descriptors.TPSA(mol),
            'rotatable_bonds': Descriptors.NumRotatableBonds(mol),
            'sa_score': self._calc_sa_score(mol),
        }
    
    def _calc_sa_score(self, mol: Chem.Mol) -> float:
        from rdkit.Chem import Descriptors
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