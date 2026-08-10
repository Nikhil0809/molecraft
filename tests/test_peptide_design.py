from conftest import load_service_module
from fastapi.testclient import TestClient

peptide_app = load_service_module("peptide_design").app


client = TestClient(peptide_app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


def test_design_peptides_basic():
    response = client.post(
        "/design", json={"target": "EGFR", "length": 12, "cyclic": False, "count": 5}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["target"] == "EGFR"
    assert len(data["peptides"]) == 5
    assert data["best_affinity_nm"] > 0
    assert data["inference_ms"] > 0
    for pep in data["peptides"]:
        assert "sequence" in pep
        assert "length" in pep
        assert "mw_da" in pep
        assert "charge" in pep
        assert "hydrophobicity" in pep
        assert "helical_content" in pep
        assert "target_affinity_nm" in pep
        assert 0 <= pep["hydrophobicity"] <= 1


def test_design_peptides_cyclic():
    response = client.post(
        "/design", json={"target": "EGFR", "length": 12, "cyclic": True, "count": 3}
    )
    assert response.status_code == 200
    data = response.json()
    for pep in data["peptides"]:
        assert pep["cyclic"] is True


def test_design_peptides_custom_params():
    response = client.post(
        "/design",
        json={
            "target": "EGFR",
            "length": 15,
            "cyclic": False,
            "count": 3,
            "helical_fraction": 0.5,
            "hydrophobic_ratio": 0.6,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["peptides"]) == 3


def test_macrocycle_design_basic():
    response = client.post(
        "/macrocycle/design", json={"target": "CypA", "cyclization_type": "stapled", "count": 3}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["target"] == "CypA"
    assert len(data["macrocycles"]) == 3
    assert data["inference_ms"] > 0
    for macro in data["macrocycles"]:
        assert "sequence" in macro
        assert "cyclized_sequence" in macro
        assert "cyclization_type" in macro
        assert "mw_da" in macro
        assert "logp" in macro
        assert "conformational_stability" in macro
        assert "target_affinity_nm" in macro
        assert "oral_bioavailability_score" in macro


def test_macrocycle_design_all_types():
    for cycl_type in ["stapled", "disulfide", "lactam", "triazole", "thioether"]:
        response = client.post(
            "/macrocycle/design", json={"target": "Test", "cyclization_type": cycl_type, "count": 1}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["macrocycles"][0]["cyclization_type"] == cycl_type


def test_macrocycle_with_template():
    response = client.post(
        "/macrocycle/design",
        json={
            "target": "Test",
            "sequence_template": "ACDEFGHIK",
            "cyclization_type": "disulfide",
            "count": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["macrocycles"]) == 2
