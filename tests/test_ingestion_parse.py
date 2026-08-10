import io
import sys
import types

import pytest
from fastapi.testclient import TestClient


def _install_chromadb_stub():
    """chromadb is a heavy dependency; provide a minimal import shim so the
    service module loads. The /parse/* endpoints never touch chroma."""
    try:
        import chromadb  # noqa: F401
        return
    except ImportError:
        pass

    chromadb = types.ModuleType("chromadb")
    execution = types.ModuleType("chromadb.execution")
    operator = types.ModuleType("chromadb.execution.expression.operator")
    config = types.ModuleType("chromadb.config")
    utils = types.ModuleType("chromadb.utils")
    ef = types.ModuleType("chromadb.utils.embedding_functions")
    qwen_mod = types.ModuleType("chromadb.utils.embedding_functions.chroma_cloud_qwen_embedding_function")
    splade_mod = types.ModuleType("chromadb.utils.embedding_functions.chroma_cloud_splade_embedding_function")

    class _CloudClient:
        def __init__(self, *args, **kwargs):
            pass

    class _PersistentClient:
        def __init__(self, *args, **kwargs):
            pass

    class _Schema:
        def __init__(self):
            pass

    class _DefaultEmbeddingFunction:
        def __init__(self, *args, **kwargs):
            pass

    class _ChromaCloudEmbeddingFunction:
        def __init__(self, *args, **kwargs):
            pass

    class _EmbeddingModel:
        QWEN3_EMBEDDING_0p6B = "qwen3-embedding-0.6b"

    for name in ("Search", "K", "Knn", "Rrf", "VectorIndexConfig", "SparseVectorIndexConfig"):
        setattr(chromadb, name, type(name, (), {}))
    chromadb.CloudClient = _CloudClient
    chromadb.PersistentClient = _PersistentClient
    chromadb.Schema = _Schema
    chromadb.Client = _CloudClient
    chromadb.utils = utils

    config.Settings = type("Settings", (), {"__init__": lambda self, *a, **k: None})

    ef.DefaultEmbeddingFunction = _DefaultEmbeddingFunction
    ef.OpenAIEmbeddingFunction = _DefaultEmbeddingFunction
    ef.ChromaCloudQwenEmbeddingFunction = _ChromaCloudEmbeddingFunction
    ef.ChromaCloudSpladeEmbeddingFunction = _ChromaCloudEmbeddingFunction
    ef.chroma_cloud_qwen_embedding_function = qwen_mod
    ef.chroma_cloud_splade_embedding_function = splade_mod

    operator.GroupBy = type("GroupBy", (), {})
    operator.MinK = type("MinK", (), {})
    execution.expression = types.ModuleType("chromadb.execution.expression")
    execution.expression.operator = operator
    chromadb.execution = execution

    class _QWENModel:
        QWEN3_EMBEDDING_0p6B = "qwen3-embedding-0.6b"

    class _SPLADEModel:
        SPLADE_IX = "splade-ix"

    qwen_mod.ChromaCloudQwenEmbeddingModel = _QWENModel
    splade_mod.ChromaCloudSpladeEmbeddingModel = _SPLADEModel

    chromadb.utils.embedding_functions = ef
    sys.modules["chromadb"] = chromadb
    sys.modules["chromadb.config"] = config
    sys.modules["chromadb.utils"] = utils
    sys.modules["chromadb.utils.embedding_functions"] = ef
    sys.modules["chromadb.utils.embedding_functions.chroma_cloud_qwen_embedding_function"] = qwen_mod
    sys.modules["chromadb.utils.embedding_functions.chroma_cloud_splade_embedding_function"] = splade_mod
    sys.modules["chromadb.execution"] = execution
    sys.modules["chromadb.execution.expression"] = execution.expression
    sys.modules["chromadb.execution.expression.operator"] = operator


_install_chromadb_stub()

from conftest import load_service_module  # noqa: E402

ingestion_mod = load_service_module("ingestion_service")
ingestion_app = ingestion_mod.app

client = TestClient(ingestion_app)

SAMPLE_SMILES_TXT = (
    "# aspirin dataset\n"
    "CC(=O)OC1=CC=CC=C1C(=O)O aspirin\n"
    "CN1C=NC2=C1C(=O)N(C(=O)N2C)C caffeine\n"
    "not-a-smiles line\n"
)

SAMPLE_SDF = (
    "aspirin\n"
    "\n"
    " 12 12  0  0  0  0  0  0  0  0999 V2000\n"
    "M  END\n"
    ">  <SMILES>\n"
    "CC(=O)OC1=CC=CC=C1C(=O)O\n"
    "\n"
    "$$$$\n"
)

SAMPLE_PDB = (
    "ATOM      1  N   ALA A   1      11.104  13.207  10.000  1.00  0.00           N\n"
    "ATOM      2  CA  ALA A   1      12.500  13.200  10.000  1.00  0.00           C\n"
    "ATOM      3  C   ALA A   1      13.000  14.500  10.000  1.00  0.00           C\n"
    "TER\n"
    "END\n"
)


def test_parse_smiles_file():
    response = client.post(
        "/parse/file",
        files={"file": ("ligands.smi", io.BytesIO(SAMPLE_SMILES_TXT.encode()), "text/plain")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "smiles"
    assert data["stats"]["smiles_count"] == 2
    smiles = [m["smiles"] for m in data["molecules"]]
    assert "CC(=O)OC1=CC=CC=C1C(=O)O" in smiles
    assert "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" in smiles


def test_parse_sdf_file():
    response = client.post(
        "/parse/file",
        files={"file": ("ligands.sdf", io.BytesIO(SAMPLE_SDF.encode()), "chemical/x-mdl-sdfile")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "sdf"
    assert data["stats"]["compound_count"] == 1
    assert data["stats"]["smiles_extracted"] == 1
    assert data["molecules"][0]["smiles"] == "CC(=O)OC1=CC=CC=C1C(=O)O"
    assert data["molecules"][0]["title"] == "aspirin"


def test_parse_sdf_without_property_block():
    response = client.post(
        "/parse/file",
        files={"file": ("no_props.sdf", io.BytesIO(b"compound\n\n 5  4 0 0\nM  END\n$$$$\n"), "text/plain")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "sdf"
    assert data["stats"]["compound_count"] == 1
    assert data["molecules"][0]["title"] == "compound"


def test_parse_pdb_file():
    response = client.post(
        "/parse/file",
        files={"file": ("receptor.pdb", io.BytesIO(SAMPLE_PDB.encode()), "text/plain")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "pdb"
    assert data["stats"]["atom_count"] == 3
    assert "ALA" in data["stats"]["residues"]


def test_parse_pdf_fallback():
    response = client.post(
        "/parse/file",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4\nnot a real pdf"), "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "pdf"


def test_parse_unsupported_type():
    response = client.post(
        "/parse/file",
        files={"file": ("evil.exe", io.BytesIO(b"MZ..."), "application/octet-stream")},
    )
    assert response.status_code == 400


def test_parse_empty_file():
    response = client.post(
        "/parse/file",
        files={"file": ("empty.smi", io.BytesIO(b""), "text/plain")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["stats"] == {"smiles_count": 0}


def test_parse_text_endpoint():
    response = client.post("/parse", json={"text": "CC(=O)Oc1ccccc1C(=O)O\nCCO\n"})
    assert response.status_code == 200
    data = response.json()
    assert data["stats"]["smiles_count"] >= 1