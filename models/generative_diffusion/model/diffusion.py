import math
from typing import Optional, Tuple, List
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import MessagePassing, global_mean_pool
from torch_geometric.utils import add_self_loops, degree
from torch_scatter import scatter


class EquivariantVectorLayer(nn.Module):
    def __init__(self, in_scalar: int, in_vector: int, out_scalar: int, out_vector: int):
        super().__init__()
        self.in_scalar = in_scalar
        self.in_vector = in_vector
        self.out_scalar = out_scalar
        self.out_vector = out_vector
        
        self.scalar_to_scalar = nn.Linear(in_scalar, out_scalar)
        self.vector_to_vector = nn.Linear(in_vector, out_vector, bias=False)
        self.scalar_to_vector = nn.Linear(in_scalar, out_vector, bias=False)
        
    def forward(self, scalars: torch.Tensor, vectors: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        out_scalars = self.scalar_to_scalar(scalars)
        out_vectors = self.vector_to_vector(vectors) + self.scalar_to_vector(scalars).unsqueeze(-1)
        return out_scalars, out_vectors


class TensorProductLayer(nn.Module):
    def __init__(self, in_scalar: int, in_vector: int, out_scalar: int, out_vector: int, hidden: int = 64):
        super().__init__()
        self.scalar_net = nn.Sequential(
            nn.Linear(in_scalar, hidden),
            nn.SiLU(),
            nn.Linear(hidden, out_scalar + out_vector * in_vector)
        )
        
    def forward(self, scalars: torch.Tensor, vectors: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        out = self.scalar_net(scalars)
        scalar_out = out[:, :self.out_scalar]
        vector_weight = out[:, self.out_scalar:].view(-1, self.out_vector, self.in_vector)
        vector_out = torch.einsum('bij,bjk->bik', vector_weight, vectors)
        return scalar_out, vector_out


class EquivariantAttention(MessagePassing):
    def __init__(self, hidden_dim: int, num_heads: int = 4, cutoff: float = 5.0):
        super().__init__(aggr='add', node_dim=0)
        self.hidden_dim = hidden_dim
        self.num_heads = num_heads
        self.head_dim = hidden_dim // num_heads
        self.cutoff = cutoff
        
        self.q_proj = nn.Linear(hidden_dim, hidden_dim)
        self.k_proj = nn.Linear(hidden_dim, hidden_dim)
        self.v_proj = nn.Linear(hidden_dim, hidden_dim)
        
        self.pos_mlp = nn.Sequential(
            nn.Linear(3, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, num_heads)
        )
        
        self.edge_mlp = nn.Sequential(
            nn.Linear(hidden_dim * 2 + 1, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, hidden_dim)
        )
        
        self.out_proj = nn.Linear(hidden_dim, hidden_dim)
        
    def forward(self, x: torch.Tensor, pos: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        return self.propagate(edge_index, x=x, pos=pos)
    
    def message(self, x_i: torch.Tensor, x_j: torch.Tensor, pos_i: torch.Tensor, pos_j: torch.Tensor, index: torch.Tensor, ptr: Optional[torch.Tensor], size_i: Optional[int]) -> torch.Tensor:
        rel_pos = pos_j - pos_i
        dist = torch.norm(rel_pos, dim=-1, keepdim=True)
        
        cutoff_weight = self._cosine_cutoff(dist)
        
        q = self.q_proj(x_i).view(-1, self.num_heads, self.head_dim)
        k = self.k_proj(x_j).view(-1, self.num_heads, self.head_dim)
        v = self.v_proj(x_j).view(-1, self.num_heads, self.head_dim)
        
        pos_bias = self.pos_mlp(rel_pos)
        attn = (q * k).sum(dim=-1) / math.sqrt(self.head_dim) + pos_bias
        attn = F.softmax(attn, dim=0)
        attn = attn * cutoff_weight
        
        out = (attn.unsqueeze(-1) * v).view(-1, self.hidden_dim)
        return out
    
    def _cosine_cutoff(self, dist: torch.Tensor) -> torch.Tensor:
        cutoff = self.cutoff
        return torch.where(
            dist < cutoff,
            0.5 * (torch.cos(math.pi * dist / cutoff) + 1),
            torch.zeros_like(dist)
        )
    
    def update(self, aggr_out: torch.Tensor) -> torch.Tensor:
        return self.out_proj(aggr_out)


class PocketEncoder(nn.Module):
    def __init__(self, hidden_dim: int = 256, num_layers: int = 4, num_heads: int = 8):
        super().__init__()
        self.hidden_dim = hidden_dim
        
        self.atom_embedding = nn.Embedding(100, hidden_dim)
        self.residue_embedding = nn.Embedding(25, hidden_dim)
        
        self.layers = nn.ModuleList([
            EquivariantAttention(hidden_dim, num_heads, cutoff=10.0)
            for _ in range(num_layers)
        ])
        
        self.norm_layers = nn.ModuleList([
            nn.LayerNorm(hidden_dim) for _ in range(num_layers)
        ])
        
        self.output_proj = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, hidden_dim)
        )
        
    def forward(self, pocket_atoms: torch.Tensor, pocket_pos: torch.Tensor, 
                pocket_residues: torch.Tensor, pocket_edge_index: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        h = self.atom_embedding(pocket_atoms) + self.residue_embedding(pocket_residues)
        
        for layer, norm in zip(self.layers, self.norm_layers):
            h = h + layer(h, pocket_pos, pocket_edge_index)
            h = norm(h)
        
        pocket_features = self.output_proj(h)
        return pocket_features, pocket_pos


class MolDiffModel(nn.Module):
    def __init__(
        self,
        hidden_dim: int = 256,
        num_layers: int = 6,
        num_heads: int = 8,
        max_atoms: int = 50,
        atom_types: int = 100,
        bond_types: int = 4,
        timesteps: int = 1000,
        guidance_scale: float = 3.0
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.max_atoms = max_atoms
        self.atom_types = atom_types
        self.bond_types = bond_types
        self.timesteps = timesteps
        self.guidance_scale = guidance_scale
        
        self.pocket_encoder = PocketEncoder(hidden_dim, num_layers=3, num_heads=4)
        
        self.time_embedding = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim * 4),
            nn.SiLU(),
            nn.Linear(hidden_dim * 4, hidden_dim)
        )
        
        self.atom_type_embedding = nn.Embedding(atom_types, hidden_dim)
        self.atom_charge_embedding = nn.Embedding(5, hidden_dim)
        
        self.diffusion_layers = nn.ModuleList([
            EquivariantAttention(hidden_dim, num_heads, cutoff=5.0)
            for _ in range(num_layers)
        ])
        
        self.norm_layers = nn.ModuleList([
            nn.LayerNorm(hidden_dim) for _ in range(num_layers)
        ])
        
        self.atom_type_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, atom_types)
        )
        
        self.charge_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, 5)
        )
        
        self.pos_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, 3)
        )
        
        self.bond_head = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, bond_types)
        )
        
        self.property_predictor = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, 6)
        )
        
        self.register_buffer('betas', self._cosine_beta_schedule(timesteps))
        self.register_buffer('alphas', 1.0 - self.betas)
        self.register_buffer('alphas_cumprod', torch.cumprod(self.alphas, dim=0))
        self.register_buffer('alphas_cumprod_prev', F.pad(self.alphas_cumprod[:-1], (1, 0), value=1.0))
        
    def _cosine_beta_schedule(self, timesteps: int, s: float = 0.008) -> torch.Tensor:
        steps = timesteps + 1
        x = torch.linspace(0, timesteps, steps)
        alphas_cumprod = torch.cos(((x / timesteps) + s) / (1 + s) * math.pi * 0.5) ** 2
        alphas_cumprod = alphas_cumprod / alphas_cumprod[0]
        betas = 1 - (alphas_cumprod[1:] / alphas_cumprod[:-1])
        return torch.clip(betas, 0, 0.999)
    
    def _get_time_embedding(self, t: torch.Tensor) -> torch.Tensor:
        half_dim = self.hidden_dim // 2
        emb = math.log(10000) / (half_dim - 1)
        emb = torch.exp(torch.arange(half_dim, device=t.device) * -emb)
        emb = t[:, None] * emb[None, :]
        emb = torch.cat([torch.sin(emb), torch.cos(emb)], dim=-1)
        return self.time_embedding(emb)
    
    def forward(
        self,
        atom_types_t: torch.Tensor,
        charges_t: torch.Tensor,
        pos_t: torch.Tensor,
        t: torch.Tensor,
        pocket_features: Optional[torch.Tensor] = None,
        pocket_pos: Optional[torch.Tensor] = None,
        pocket_edge_index: Optional[torch.Tensor] = None,
        ligand_edge_index: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        batch_size, num_atoms = atom_types_t.shape
        
        time_emb = self._get_time_embedding(t)
        
        h = self.atom_type_embedding(atom_types_t) + self.atom_charge_embedding(charges_t)
        h = h + time_emb.unsqueeze(1)
        
        if pocket_features is not None and pocket_pos is not None:
            cross_edge_index = self._build_cross_edges(pos_t, pocket_pos, batch_size, num_atoms)
            h = self._cross_attention(h, pos_t, pocket_features, pocket_pos, cross_edge_index)
        
        if ligand_edge_index is not None:
            for layer, norm in zip(self.diffusion_layers, self.norm_layers):
                h = h + layer(h, pos_t, ligand_edge_index)
                h = norm(h)
        
        atom_type_logits = self.atom_type_head(h)
        charge_logits = self.charge_head(h)
        pos_pred = self.pos_head(h)
        
        if ligand_edge_index is not None:
            src, dst = ligand_edge_index
            edge_features = torch.cat([h[:, src], h[:, dst]], dim=-1)
            bond_logits = self.bond_head(edge_features)
        else:
            bond_logits = None
        
        return atom_type_logits, charge_logits, pos_pred, bond_logits
    
    def _build_cross_edges(self, lig_pos: torch.Tensor, pocket_pos: torch.Tensor, 
                           batch_size: int, num_atoms: int) -> torch.Tensor:
        device = lig_pos.device
        edges = []
        for b in range(batch_size):
            lig = lig_pos[b]
            pocket = pocket_pos[b]
            dist = torch.cdist(lig, pocket)
            mask = dist < 8.0
            src, dst = torch.where(mask)
            src = src + b * num_atoms
            dst = dst + b * pocket_pos.shape[1]
            edges.append(torch.stack([src, dst]))
        if edges:
            return torch.cat(edges, dim=1)
        return torch.empty((2, 0), dtype=torch.long, device=device)
    
    def _cross_attention(self, lig_h: torch.Tensor, lig_pos: torch.Tensor,
                         pocket_h: torch.Tensor, pocket_pos: torch.Tensor,
                         edge_index: torch.Tensor) -> torch.Tensor:
        if edge_index.shape[1] == 0:
            return lig_h
        
        src, dst = edge_index
        rel_pos = pocket_pos.view(-1, 3)[dst] - lig_pos.view(-1, 3)[src]
        dist = torch.norm(rel_pos, dim=-1, keepdim=True)
        
        cutoff_weight = 0.5 * (torch.cos(math.pi * dist / 8.0) + 1)
        cutoff_weight = cutoff_weight * (dist < 8.0).float()
        
        msg = pocket_h.view(-1, self.hidden_dim)[dst] * cutoff_weight
        aggr = scatter(msg, src, dim=0, dim_size=lig_h.shape[0] * lig_h.shape[1], reduce='add')
        aggr = aggr.view(lig_h.shape[0], lig_h.shape[1], self.hidden_dim)
        
        return lig_h + aggr
    
    def predict_properties(self, h: torch.Tensor) -> torch.Tensor:
        mol_repr = global_mean_pool(h.view(-1, self.hidden_dim), 
                                    torch.arange(h.shape[0], device=h.device).repeat_interleave(h.shape[1]))
        return self.property_predictor(mol_repr)


def load_pretrained_moldiff(checkpoint_path: str, device: str = 'cuda') -> MolDiffModel:
    checkpoint = torch.load(checkpoint_path, map_location=device)
    config = checkpoint.get('config', {})
    model = MolDiffModel(**config)
    model.load_state_dict(checkpoint['model_state_dict'])
    model.to(device)
    model.eval()
    return model