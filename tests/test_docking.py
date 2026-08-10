import pytest
from conftest import load_service_module
from fastapi.testclient import TestClient

docking_mod = load_service_module("docking")
docking_app = docking_mod.app


client = TestClient(docking_app)


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


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "vina_installed" in data
    assert "gnina_installed" in data
    assert "diffdock_available" in data
    assert "esmfold_available" in data
    assert "engines" in data
    assert set(data["engines"]) == {"vina", "diffdock", "gnina", "esmfold"}


def test_dock_invalid_smiles():
    response = client.post(
        "/dock", json={"smiles": "INVALID", "target_uniprot": "P00533", "engine": "vina"}
    )
    assert response.status_code == 400


def test_dock_missing_target():
    response = client.post("/dock", json={"smiles": "CCO", "engine": "vina"})
    assert response.status_code == 400


def test_dock_vina(receptor_pdb):
    response = client.post(
        "/dock", json={"smiles": "CCO", "target_pdb": receptor_pdb, "engine": "vina"}
    )
    assert response.status_code in [200, 503]
    if response.status_code == 200:
        data = response.json()
        assert data["engine"] == "vina"
        assert "poses" in data
        assert "request_id" in data


def test_dock_diffdock(receptor_pdb):
    response = client.post(
        "/dock", json={"smiles": "CCO", "target_pdb": receptor_pdb, "engine": "diffdock"}
    )
    assert response.status_code in [200, 503]
    if response.status_code == 200:
        data = response.json()
        assert data["engine"] == "diffdock"
        assert "poses" in data


def test_dock_gnina(receptor_pdb):
    response = client.post(
        "/dock", json={"smiles": "CCO", "target_pdb": receptor_pdb, "engine": "gnina"}
    )
    assert response.status_code in [200, 503]
    if response.status_code == 200:
        data = response.json()
        assert data["engine"] == "gnina"
        assert "poses" in data


def test_dock_esmfold(receptor_pdb):
    response = client.post(
        "/dock", json={"smiles": "CCO", "target_pdb": receptor_pdb, "engine": "esmfold"}
    )
    assert response.status_code in [200, 503]
    if response.status_code == 200:
        data = response.json()
        assert data["engine"] == "esmfold"
        assert "poses" in data


def test_detect_binding_site():
    response = client.post("/detect-binding-site", json={"target_uniprot": "P00533"})
    assert response.status_code in [200, 400, 500]
    if response.status_code == 200:
        data = response.json()
        assert "pockets" in data
        assert "method" in data


def test_smiles_to_pdbqt():
    pdbqt = docking_mod.smiles_to_pdbqt("CCO")
    assert pdbqt is not None
    assert "ATOM" in pdbqt or "HETATM" in pdbqt


def test_smiles_to_pdbqt_invalid():
    pdbqt = docking_mod.smiles_to_pdbqt("INVALID")
    assert pdbqt is None
