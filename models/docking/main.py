import os
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdkit import Chem
from rdkit.Chem import AllChem, rdMolDescriptors

app = FastAPI(title="MoleCraft Docking Service", version="1.0.0")

VINA_PATH = os.environ.get("VINA_PATH", "vina")
VINA_CONFIG = os.environ.get("VINA_CONFIG", "")


class DockingRequest(BaseModel):
    smiles: str = Field(..., description="SMILES of the ligand")
    target_pdb: str = Field(default="", description="Path or URL to target PDB file")
    target_uniprot: str = Field(default="", description="UniProt ID to fetch structure")
    center_x: float = Field(default=0.0, description="Binding site center X")
    center_y: float = Field(default=0.0, description="Binding site center Y")
    center_z: float = Field(default=0.0, description="Binding site center Z")
    size_x: float = Field(default=20.0, description="Box size X (Angstrom)")
    size_y: float = Field(default=20.0, description="Box size Y (Angstrom)")
    size_z: float = Field(default=20.0, description="Box size Z (Angstrom)")
    exhaustiveness: int = Field(default=8, ge=1, le=32)
    num_poses: int = Field(default=9, ge=1, le=50)
    engine: str = Field(default="vina", pattern="^(vina|diffdock|gnina)$")


class DockingPose(BaseModel):
    pose_id: int
    affinity_kcal_mol: float
    rmsd_lb: float
    rmsd_ub: float


class DockingResponse(BaseModel):
    request_id: str
    smiles: str
    target: str
    engine: str
    num_poses: int
    poses: list[DockingPose]
    status: str


def smiles_to_pdbqt(smiles: str) -> Optional[str]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    mol = Chem.AddHs(mol)
    try:
        AllChem.EmbedMolecule(mol, AllChem.ETKDG())
        AllChem.MMFFOptimizeMolecule(mol)
    except Exception:
        pass
    pdb_block = Chem.MolToPDBBlock(mol)
    pdbqt_lines = []
    for line in pdb_block.split("\n"):
        if line.startswith("ATOM") or line.startswith("HETATM"):
            atom_type = line[76:78].strip()
            pdbqt_lines.append(
                f"{line:<66} {atom_type:>2}"
            )
    return "\n".join(pdbqt_lines) if pdbqt_lines else None


@app.post("/dock")
def dock(req: DockingRequest) -> DockingResponse:
    request_id = str(uuid.uuid4())

    if req.engine == "diffdock":
        return DockingResponse(
            request_id=request_id,
            smiles=req.smiles,
            target=req.target_uniprot or req.target_pdb,
            engine="diffdock",
            num_poses=0,
            poses=[],
            status="DiffDock not yet integrated. Set engine=vina for AutoDock Vina.",
        )

    if req.engine == "gnina":
        return DockingResponse(
            request_id=request_id,
            smiles=req.smiles,
            target=req.target_uniprot or req.target_pdb,
            engine="gnina",
            num_poses=0,
            poses=[],
            status="GNINA not yet integrated. Set engine=vina for AutoDock Vina.",
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        ligand_pdbqt = tmp / "ligand.pdbqt"
        receptor_pdbqt = tmp / "receptor.pdbqt"
        output_pdbqt = tmp / "output.pdbqt"
        log_path = tmp / "log.txt"

        ligand_str = smiles_to_pdbqt(req.smiles)
        if ligand_str is None:
            raise HTTPException(status_code=400, detail="Invalid SMILES for docking")

        ligand_pdbqt.write_text(ligand_str)

        if req.target_pdb and Path(req.target_pdb).exists():
            receptor_pdb = req.target_pdb
        elif req.target_uniprot:
            receptor_pdb = str(tmp / "receptor.pdb")
            import urllib.request
            url = f"https://alphafold.ebi.ac.uk/files/AF-{req.target_uniprot}-F1-model_v4.pdb"
            try:
                urllib.request.urlretrieve(url, receptor_pdb)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Could not fetch structure: {e}")
        else:
            raise HTTPException(status_code=400, detail="Either target_pdb or target_uniprot required")

        try:
            subprocess.run(
                ["obabel", receptor_pdb, "-o", "pdbqt", "-O", str(receptor_pdbqt)],
                capture_output=True, timeout=30,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=503, detail="OpenBabel not installed. Install with: conda install openbabel")

        if not receptor_pdbqt.exists():
            receptor_pdbqt.write_text("")  # placeholder

        if VINA_CONFIG:
            cmd = [
                VINA_PATH,
                "--config", VINA_CONFIG,
                "--ligand", str(ligand_pdbqt),
                "--out", str(output_pdbqt),
                "--log", str(log_path),
            ]
        else:
            cmd = [
                VINA_PATH,
                "--receptor", str(receptor_pdbqt),
                "--ligand", str(ligand_pdbqt),
                "--out", str(output_pdbqt),
                "--center_x", str(req.center_x),
                "--center_y", str(req.center_y),
                "--center_z", str(req.center_z),
                "--size_x", str(req.size_x),
                "--size_y", str(req.size_y),
                "--size_z", str(req.size_z),
                "--exhaustiveness", str(req.exhaustiveness),
                "--num_modes", str(req.num_poses),
                "--log", str(log_path),
            ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        except FileNotFoundError:
            return DockingResponse(
                request_id=request_id,
                smiles=req.smiles,
                target=req.target_uniprot or req.target_pdb,
                engine="vina",
                num_poses=0,
                poses=[],
                status="AutoDock Vina not found. Install from https://vina.scripps.edu/",
            )

        poses = []
        log_text = log_path.read_text() if log_path.exists() else result.stdout
        for line in log_text.split("\n"):
            if "mode" in line.lower() and "affinity" in line.lower():
                continue
            parts = line.strip().split()
            if len(parts) >= 4 and parts[0].isdigit():
                try:
                    poses.append(DockingPose(
                        pose_id=int(parts[0]),
                        affinity_kcal_mol=float(parts[1]),
                        rmsd_lb=float(parts[2]),
                        rmsd_ub=float(parts[3]),
                    ))
                except (ValueError, IndexError):
                    pass

        return DockingResponse(
            request_id=request_id,
            smiles=req.smiles,
            target=req.target_uniprot or req.target_pdb,
            engine="vina",
            num_poses=len(poses),
            poses=poses,
            status="completed" if poses else "no_poses_found",
        )


@app.get("/health")
def health():
    vina_found = False
    try:
        subprocess.run([VINA_PATH, "--version"], capture_output=True, timeout=5)
        vina_found = True
    except Exception:
        pass
    return {"status": "ok", "vina_installed": vina_found, "engine": "vina"}
