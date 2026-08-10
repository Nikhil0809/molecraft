import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent / "models"))
from gateway import app as gateway_app

client = TestClient(gateway_app)


@pytest.fixture
def receptor_pdb(tmp_path):
    pdb = tmp_path / "receptor.pdb"
    pdb.write_text(
        "ATOM      1  N   GLY A   1      -1.000  -1.000  -1.000  1.00  0.00           N\n"
        "ATOM      2  CA  GLY A   1       0.000   0.000   0.000  1.00  0.00           C\n"
        "ATOM      3  C   GLY A   1       1.000   1.000   1.000  1.00  0.00           C\n"
        "ATOM      4  O   GLY A   1       1.500   1.500   1.500  1.00  0.00           O\n"
        "TER\n"
        "END\n"
    )
    return str(pdb)


def test_gateway_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["gateway"] is True
    assert "mounted_services" in data
    assert len(data["mounted_services"]) > 0


def test_gateway_mounts_services():
    response = client.get("/health")
    data = response.json()
    expected_services = [
        "foundation_models",
        "rna_design",
        "docking",
        "peptide_design",
        "affinity_predictor",
        "rag_pipeline",
        "proteochem",
        "admet_ml",
        "generative",
        "generative_diffusion",
    ]
    for svc in expected_services:
        assert svc in data["mounted_services"]


def test_foundation_models_via_gateway():
    response = client.post(
        "/foundation_models/gnn/predict", json={"smiles": "CCO", "target_protein": "EGFR"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data


def test_rna_design_via_gateway():
    response = client.post("/rna_design/sirna/design", json={"target_gene": "EGFR", "count": 2})
    assert response.status_code == 200
    data = response.json()
    assert "designs" in data
    assert len(data["designs"]) == 2


def test_docking_via_gateway(receptor_pdb):
    response = client.post(
        "/docking/dock", json={"smiles": "CCO", "target_pdb": receptor_pdb, "engine": "vina"}
    )
    assert response.status_code in [200, 503]


def test_peptide_design_via_gateway():
    response = client.post(
        "/peptide_design/design", json={"target": "EGFR", "length": 10, "count": 3}
    )
    assert response.status_code == 200
    data = response.json()
    assert "peptides" in data
    assert len(data["peptides"]) == 3
