import asyncio
import httpx
import json
from typing import Optional, List, Dict, Tuple
from rdkit import Chem
from rdkit.Chem import AllChem, rdMolDescriptors
import logging

logger = logging.getLogger(__name__)


class ASKCOSClient:
    def __init__(self, base_url: str = "https://askcos.mit.edu/api/v2", timeout: float = 60.0):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def retrosynthesis(self, smiles: str, n_results: int = 10) -> List[Dict]:
        try:
            resp = await self.client.post(
                f"{self.base_url}/retrosynthesis/",
                json={"smiles": smiles, "n_results": n_results}
            )
            if resp.status_code == 200:
                return resp.json().get("results", [])
        except Exception as e:
            logger.warning(f"ASKCOS retrosynthesis failed: {e}")
        return []
    
    async def forward_prediction(self, reactants: List[str]) -> List[Dict]:
        try:
            resp = await self.client.post(
                f"{self.base_url}/forward/",
                json={"reactants": reactants}
            )
            if resp.status_code == 200:
                return resp.json().get("results", [])
        except Exception as e:
            logger.warning(f"ASKCOS forward prediction failed: {e}")
        return []
    
    async def close(self):
        await self.client.aclose()


class LocalRetrosynthesis:
    def __init__(self):
        self.rxn_templates = self._load_templates()
    
    def _load_templates(self) -> List[Dict]:
        return [
            {"name": "Amide coupling", "reactants": ["[CX3:1](=O)[OH:2]", "[N:3]"], "product": "[CX3:1](=O)[N:3]"},
            {"name": "Suzuki coupling", "reactants": ["[c:1][B]([OH])[OH]", "[c:2][Cl,Br,I]"], "product": "[c:1][c:2]"},
            {"name": "Buchwald-Hartwig", "reactants": ["[c:1][Cl,Br,I]", "[N:2]"], "product": "[c:1][N:2]"},
            {"name": "Reductive amination", "reactants": ["[CX3:1]=O", "[N:2]"], "product": "[CX4:1][N:2]"},
            {"name": "Esterification", "reactants": ["[CX3:1](=O)[OH:2]", "[OH:3]"], "product": "[CX3:1](=O)[O:3]"},
            {"name": "Click chemistry", "reactants": ["[C:1]#[N:2]", "[C:3]#[N:4]"], "product": "[c:1]1[n:2][n:3][c:4]1"},
        ]
    
    def find_routes(self, smiles: str, max_depth: int = 3) -> List[Dict]:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return []
        
        routes = []
        for template in self.rxn_templates:
            matches = self._match_template(mol, template)
            if matches:
                routes.append({
                    "template": template["name"],
                    "reactants": matches,
                    "score": 0.8,
                    "depth": 1
                })
        
        return routes[:5]
    
    def _match_template(self, mol: Chem.Mol, template: Dict) -> List[str]:
        return [Chem.MolToSmiles(Chem.MolFromSmiles(s)) for s in template["reactants"]]


class SynthesisFilter:
    def __init__(
        self,
        askcos_url: Optional[str] = None,
        use_local: bool = True,
        max_sa_score: float = 5.0,
        min_route_score: float = 0.3
    ):
        self.use_local = use_local
        self.max_sa_score = max_sa_score
        self.min_route_score = min_route_score
        
        if askcos_url and not use_local:
            self.askcos = ASKCOSClient(askcos_url)
        else:
            self.askcos = None
        
        self.local = LocalRetrosynthesis()
    
    async def filter_batch(self, molecules: List[Dict]) -> List[Dict]:
        filtered = []
        for mol in molecules:
            result = await self.filter_single(mol)
            if result:
                filtered.append(result)
        return filtered
    
    async def filter_single(self, molecule: Dict) -> Optional[Dict]:
        smiles = molecule.get('smiles', '')
        if not smiles:
            return None
        
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None
        
        sa_score = self._calc_sa_score(mol)
        if sa_score > self.max_sa_score:
            return None
        
        routes = []
        if self.askcos:
            routes = await self.askcos.retrosynthesis(smiles)
        else:
            routes = self.local.find_routes(smiles)
        
        if not routes:
            return None
        
        best_route = max(routes, key=lambda r: r.get('score', 0))
        if best_route.get('score', 0) < self.min_route_score:
            return None
        
        molecule['sa_score'] = sa_score
        molecule['synthesis_routes'] = routes[:3]
        molecule['best_route_score'] = best_route.get('score', 0)
        
        return molecule
    
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
    
    async def close(self):
        if self.askcos:
            await self.askcos.close()


class BuildingBlockChecker:
    def __init__(self, catalog_path: Optional[str] = None):
        self.catalog = self._load_catalog(catalog_path)
    
    def _load_catalog(self, path: Optional[str]) -> set:
        if path:
            try:
                with open(path) as f:
                    return set(line.strip() for line in f)
            except Exception:
                pass
        return set([
            "CCO", "CC(=O)O", "C1CCCCC1", "c1ccccc1", "CN", "CCN", "CCCN",
            "c1ccncc1", "c1ccsc1", "C1CCNCC1", "CC(=O)N", "CS(=O)(=O)N"
        ])
    
    def check_availability(self, smiles: str) -> float:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return 0.0
        
        try:
            from rdkit.Chem import BRICS
            fragments = list(BRICS.BRICSDecompose(mol))
            if not fragments:
                return 0.0
            
            available = sum(1 for f in fragments if f in self.catalog)
            return available / len(fragments)
        except Exception:
            return 0.5