"""Parsers for chemistry file formats (SMILES / SDF / MOL / PDB / CSV / PDF).

Used by the ingestion service to turn uploaded files into structured,
RAG-friendly content.
"""

import re
import tempfile
from pathlib import Path
from typing import Optional

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors
    from rdkit import RDLogger

    RDLogger.DisableLog("rdApp.*")
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False

try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text

    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False

try:
    from PyPDF2 import PdfReader

    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".tsv", ".json"}
PDF_EXTENSIONS = {".pdf"}
STRUCTURE_EXTENSIONS = {".smi", ".smiles", ".sdf", ".mol", ".pdb"}
SUPPORTED_EXTENSIONS = TEXT_EXTENSIONS | PDF_EXTENSIONS | STRUCTURE_EXTENSIONS

_MAX_TEXT_CHARS = 50000


def _clean_smiles(token: str) -> str:
    token = token.strip()
    if not token:
        return ""
    token = re.sub(r"\]\s+\[", "][", token)
    m = re.search(r"\[[A-Za-z][a-z]?\d?\]", token)
    if token.startswith("[") and not m:
        return token[1:]
    return token


def _validate_smiles(smiles: str) -> bool:
    if not RDKIT_AVAILABLE:
        return bool(re.search(r"^[A-Za-z0-9@+\-\[\]()=\\#.%/.,:;*~$]+$", smiles))
    try:
        return Chem.MolFromSmiles(smiles) is not None
    except Exception:
        return False


def _parse_smiles_list(text: str, limit: int = 500) -> list[str]:
    molecules = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        token = _clean_smiles(line.split(None, 1)[0])
        if not token or len(token) > 512:
            continue
        if token not in molecules:
            molecules.append(token)
        if len(molecules) >= limit:
            break
    return molecules


def _parse_sdf(text: str, limit: int = 500) -> tuple[list[dict], str]:
    blocks = text.split("$$$$")
    molecules = []
    excerpts = []
    for block in blocks:
        lines = block.strip().splitlines()
        if not lines:
            continue
        title = lines[0].strip()
        props: dict[str, str] = {}
        current_prop = None
        smiles_candidate = ""
        atom_count = 0
        bond_count = 0
        for line in lines:
            prop_match = re.match(r"^>\s*<(.+)>\s*$", line)
            if prop_match:
                current_prop = prop_match.group(1).strip()
                continue
            if current_prop:
                value = line.strip()
                if value:
                    props[current_prop] = (props.get(current_prop, "") + " " + value).strip()
                    if current_prop.upper().startswith("SMILES") and not smiles_candidate:
                        smiles_candidate = value
                continue
            if current_prop == "" and line.strip() == "":
                continue
            m_counts = re.match(r"^\s*(\d+)\s+(\d+)\s+", line)
            if m_counts and "M  END" not in line:
                try:
                    atom_count = int(m_counts.group(1))
                    bond_count = int(m_counts.group(2))
                except ValueError:
                    pass
        smiles = smiles_candidate or props.get("SMILES", "") or props.get("smiles", "")
        entry = {
            "title": title,
            "smiles": smiles,
            "properties": {k: v for k, v in props.items()},
            "atom_count": atom_count,
            "bond_count": bond_count,
            "formula": (
                re.search(r"^\S+", title or "").group(0)
                if title and re.match(r"^[A-Z][a-z]?\d", title)
                else ""
            ),
        }
        molecules.append(entry)
        if smiles:
            excerpts.append(f"{title or 'compound'}: {smiles}")
        if len(molecules) >= limit:
            break
    return molecules, "\n".join(excerpts[:300])


def _parse_pdb(text: str) -> dict:
    atoms = 0
    hetatm = 0
    chains: set[str] = set()
    residues: set[str] = set()
    for line in text.splitlines():
        record = line[:6].strip()
        if record == "ATOM":
            atoms += 1
        elif record == "HETATM":
            hetatm += 1
        if record in ("ATOM", "HETATM"):
            chain = line[21].strip() if len(line) > 21 else ""
            resname = line[17:20].strip()
            if chain:
                chains.add(chain)
            if resname:
                residues.add(resname)
    return {
        "atom_count": atoms,
        "hetatm_count": hetatm,
        "chains": sorted(chains),
        "residue_count": len(residues),
        "residues": sorted(residues),
    }


def parse_pdf(content: bytes) -> str:
    """Extract text from a PDF using pdfminer, falling back to PyPDF2."""
    if PDFMINER_AVAILABLE:
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                return pdfminer_extract_text(tmp_path) or ""
            finally:
                Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass
    if PYPDF2_AVAILABLE:
        try:
            import io

            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            pass
    return ""


def extract_smiles(text: str, limit: int = 500) -> list[str]:
    """Pull likely SMILES tokens out of arbitrary text."""
    candidates = []
    for token in text.replace(",", " ").replace(";", " ").split():
        token = _clean_smiles(token)
        if not token or len(token) > 512:
            continue
        if token in candidates:
            continue
        if _validate_smiles(token):
            candidates.append(token)
        if len(candidates) >= limit:
            break
    return candidates


def parse_file(filename: str, content: bytes) -> dict:
    """Parse an uploaded file into structured, RAG-friendly content."""
    name = filename or "unknown"
    ext = Path(name).suffix.lower()
    entry: dict = {"filename": name, "type": "unknown", "size_bytes": len(content)}

    if ext in PDF_EXTENSIONS:
        text = parse_pdf(content)
        entry["type"] = "pdf"
        entry["text_excerpt"] = text[:_MAX_TEXT_CHARS]
        entry["document_text"] = text[:_MAX_TEXT_CHARS]
        entry["stats"] = {"char_count": len(text)}
        entry["molecules"] = []
        return entry

    if ext in STRUCTURE_EXTENSIONS or ext in TEXT_EXTENSIONS:
        try:
            text = content.decode("utf-8", errors="replace")
        except Exception:
            text = content.decode("latin-1", errors="replace")
        entry["text_excerpt"] = text[:_MAX_TEXT_CHARS]

        if ext == ".sdf":
            molecules, excerpts = _parse_sdf(text)
            entry["type"] = "sdf"
            entry["molecules"] = molecules
            entry["stats"] = {
                "compound_count": len(molecules),
                "smiles_extracted": sum(1 for m in molecules if m["smiles"]),
            }
        elif ext == ".pdb":
            stats = _parse_pdb(text)
            entry["type"] = "pdb"
            entry["molecules"] = []
            entry["stats"] = stats
        else:
            smiles_list = extract_smiles(text)
            entry["type"] = "smiles"
            entry["molecules"] = [{"index": i, "smiles": s} for i, s in enumerate(smiles_list, 1)]
            entry["stats"] = {"smiles_count": len(smiles_list)}
            entry["text_excerpt"] = "\n".join(smiles_list[:_MAX_TEXT_CHARS]) if smiles_list else text[:_MAX_TEXT_CHARS]
        return entry

    entry["type"] = "other"
    try:
        entry["text_excerpt"] = content.decode("utf-8", errors="replace")[:_MAX_TEXT_CHARS]
    except Exception:
        entry["text_excerpt"] = ""
    entry["molecules"] = []
    entry["stats"] = {}
    return entry