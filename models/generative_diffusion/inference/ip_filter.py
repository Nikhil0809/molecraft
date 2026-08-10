import numpy as np
from typing import List, Dict, Set, Optional, Tuple
from rdkit import Chem
from rdkit.Chem import AllChem, rdMolDescriptors
from rdkit.Chem.Fingerprints import FingerprintMols
from rdkit.DataStructs import TanimotoSimilarity, BulkTanimotoSimilarity
import json
import os
import logging

logger = logging.getLogger(__name__)


class PatentDatabase:
    def __init__(self, db_path: Optional[str] = None, fp_type: str = "morgan"):
        self.fp_type = fp_type
        self.fingerprints: List[np.ndarray] = []
        self.metadata: List[Dict] = []
        self.radius = 2
        self.n_bits = 2048
        
        if db_path and os.path.exists(db_path):
            self.load(db_path)
    
    def add_patent(self, smiles: str, patent_id: str, claims: List[str] = None) -> bool:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return False
        
        fp = self._compute_fingerprint(mol)
        self.fingerprints.append(fp)
        self.metadata.append({
            'patent_id': patent_id,
            'smiles': smiles,
            'claims': claims or [],
            'fp_idx': len(self.fingerprints) - 1
        })
        return True
    
    def add_patents_bulk(self, patents: List[Dict]):
        for p in patents:
            self.add_patent(p.get('smiles', ''), p.get('patent_id', ''), p.get('claims'))
    
    def _compute_fingerprint(self, mol: Chem.Mol) -> np.ndarray:
        if self.fp_type == "morgan":
            fp = AllChem.GetMorganFingerprintAsBitVect(mol, self.radius, nBits=self.n_bits)
        elif self.fp_type == "rdkit":
            fp = FingerprintMols.FingerprintMol(mol, fpSize=self.n_bits)
        else:
            fp = AllChem.GetMorganFingerprintAsBitVect(mol, self.radius, nBits=self.n_bits)
        
        arr = np.zeros((self.n_bits,), dtype=np.uint8)
        AllChem.DataStructs.ConvertToNumpyArray(fp, arr)
        return arr
    
    def search(self, smiles: str, threshold: float = 0.8, top_k: int = 10) -> List[Dict]:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return []
        
        query_fp = self._compute_fingerprint(mol)
        
        if not self.fingerprints:
            return []
        
        fps_array = np.stack(self.fingerprints)
        
        if self.fp_type == "morgan":
            similarities = BulkTanimotoSimilarity(query_fp, [fps for fps in fps_array])
        else:
            similarities = [TanimotoSimilarity(query_fp, fp) for fp in fps_array]
        
        similarities = np.array(similarities)
        matches = np.where(similarities >= threshold)[0]
        
        if len(matches) == 0:
            return []
        
        top_indices = matches[np.argsort(similarities[matches])[::-1]][:top_k]
        
        results = []
        for idx in top_indices:
            results.append({
                'patent_id': self.metadata[idx]['patent_id'],
                'similarity': float(similarities[idx]),
                'smiles': self.metadata[idx]['smiles'],
                'claims': self.metadata[idx]['claims']
            })
        
        return results
    
    def check_novelty(self, smiles: str, threshold: float = 0.7) -> Dict:
        matches = self.search(smiles, threshold=threshold, top_k=5)
        
        is_novel = len(matches) == 0
        max_similarity = max([m['similarity'] for m in matches], default=0.0)
        
        return {
            'is_novel': is_novel,
            'max_similarity': max_similarity,
            'similar_patents': matches,
            'threshold': threshold
        }
    
    def save(self, path: str):
        data = {
            'fingerprints': [fp.tolist() for fp in self.fingerprints],
            'metadata': self.metadata,
            'fp_type': self.fp_type,
            'radius': self.radius,
            'n_bits': self.n_bits
        }
        with open(path, 'w') as f:
            json.dump(data, f)
    
    def load(self, path: str):
        with open(path) as f:
            data = json.load(f)
        
        self.fingerprints = [np.array(fp, dtype=np.uint8) for fp in data['fingerprints']]
        self.metadata = data['metadata']
        self.fp_type = data.get('fp_type', 'morgan')
        self.radius = data.get('radius', 2)
        self.n_bits = data.get('n_bits', 2048)


class ScaffoldMatcher:
    def __init__(self):
        from rdkit.Chem.Scaffolds import MurckoScaffold
        self.MurckoScaffold = MurckoScaffold
    
    def get_scaffold(self, smiles: str) -> Optional[str]:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None
        try:
            scaffold = self.MurckoScaffold.GetScaffoldForMol(mol)
            return Chem.MolToSmiles(scaffold)
        except Exception:
            return None
    
    def get_generic_scaffold(self, smiles: str) -> Optional[str]:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None
        try:
            scaffold = self.MurckoScaffold.GetScaffoldForMol(mol)
            generic = self.MurckoScaffold.MakeScaffoldGeneric(scaffold)
            return Chem.MolToSmiles(generic)
        except Exception:
            return None
    
    def match_scaffolds(self, query_smiles: str, patent_smiles_list: List[str]) -> List[Dict]:
        query_scaffold = self.get_scaffold(query_smiles)
        query_generic = self.get_generic_scaffold(query_smiles)
        
        if not query_scaffold:
            return []
        
        matches = []
        for p_smiles in patent_smiles_list:
            p_scaffold = self.get_scaffold(p_smiles)
            p_generic = self.get_generic_scaffold(p_smiles)
            
            if not p_scaffold:
                continue
            
            exact_match = query_scaffold == p_scaffold
            generic_match = query_generic == p_generic
            
            if exact_match or generic_match:
                matches.append({
                    'patent_smiles': p_smiles,
                    'exact_scaffold_match': exact_match,
                    'generic_scaffold_match': generic_match,
                    'query_scaffold': query_scaffold,
                    'patent_scaffold': p_scaffold
                })
        
        return matches


class IPFilter:
    def __init__(
        self,
        patent_db_path: Optional[str] = None,
        similarity_threshold: float = 0.8,
        scaffold_threshold: float = 0.9,
        check_scaffolds: bool = True
    ):
        self.patent_db = PatentDatabase(patent_db_path)
        self.scaffold_matcher = ScaffoldMatcher()
        self.similarity_threshold = similarity_threshold
        self.scaffold_threshold = scaffold_threshold
        self.check_scaffolds = check_scaffolds
    
    def filter_batch(self, molecules: List[Dict]) -> List[Dict]:
        filtered = []
        for mol in molecules:
            result = self.filter_single(mol)
            if result:
                filtered.append(result)
        return filtered
    
    def filter_single(self, molecule: Dict) -> Optional[Dict]:
        smiles = molecule.get('smiles', '')
        if not smiles:
            return None
        
        novelty = self.patent_db.check_novelty(smiles, self.similarity_threshold)
        
        scaffold_matches = []
        if self.check_scaffolds:
            patent_smiles = [m['smiles'] for m in novelty['similar_patents']]
            scaffold_matches = self.scaffold_matcher.match_scaffolds(smiles, patent_smiles)
        
        has_ip_conflict = not novelty['is_novel'] or len(scaffold_matches) > 0
        
        if has_ip_conflict:
            molecule['ip_risk'] = 'high'
            molecule['ip_details'] = {
                'similar_patents': novelty['similar_patents'],
                'scaffold_matches': scaffold_matches,
                'max_similarity': novelty['max_similarity']
            }
        else:
            molecule['ip_risk'] = 'low'
            molecule['ip_details'] = {
                'max_similarity': novelty['max_similarity']
            }
        
        return molecule
    
    def load_patents_from_file(self, filepath: str, format: str = 'json'):
        if format == 'json':
            with open(filepath) as f:
                patents = json.load(f)
            self.patent_db.add_patents_bulk(patents)
        elif format == 'csv':
            import pandas as pd
            df = pd.read_csv(filepath)
            for _, row in df.iterrows():
                self.patent_db.add_patent(
                    row.get('smiles', ''),
                    row.get('patent_id', ''),
                    row.get('claims', '').split(';') if row.get('claims') else []
                )


class IPConstraintGenerator:
    @staticmethod
    def get_forbidden_substructures(patent_db: PatentDatabase, threshold: float = 0.85) -> List[Chem.Mol]:
        forbidden = []
        for meta in patent_db.metadata:
            mol = Chem.MolFromSmiles(meta['smiles'])
            if mol:
                forbidden.append(mol)
        return forbidden
    
    @staticmethod
    def get_forbidden_scaffolds(patent_db: PatentDatabase) -> List[str]:
        scaffolds = set()
        matcher = ScaffoldMatcher()
        for meta in patent_db.metadata:
            scaffold = matcher.get_generic_scaffold(meta['smiles'])
            if scaffold:
                scaffolds.add(scaffold)
        return list(scaffolds)
    
    @staticmethod
    def create_constraint_fn(patent_db: PatentDatabase, threshold: float = 0.85):
        forbidden_fps = []
        for meta in patent_db.metadata:
            mol = Chem.MolFromSmiles(meta['smiles'])
            if mol:
                fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)
                forbidden_fps.append(fp)
        
        def check_constraint(smiles: str) -> bool:
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return False
            fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)
            similarities = BulkTanimotoSimilarity(fp, forbidden_fps)
            return max(similarities, default=0) < threshold
        
        return check_constraint