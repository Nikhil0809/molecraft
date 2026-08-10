from conftest import load_service_module
from fastapi.testclient import TestClient

rna_app = load_service_module("rna_design").app


client = TestClient(rna_app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


def test_sirna_design_basic():
    response = client.post("/sirna/design", json={"target_gene": "EGFR", "count": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["target_gene"] == "EGFR"
    assert len(data["designs"]) == 3
    assert data["inference_ms"] > 0
    for design in data["designs"]:
        assert "sense_strand" in design
        assert "antisense_strand" in design
        assert "gc_content" in design
        assert "melting_temp_c" in design
        assert "efficacy_score" in design
        assert 0 <= design["gc_content"] <= 1
        assert design["melting_temp_c"] > 0


def test_sirna_design_with_sequence():
    response = client.post(
        "/sirna/design",
        json={"target_gene": "CUSTOM", "target_sequence": "AUGGCGACCCUGGAUGAGCU", "count": 2},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["designs"]) == 2
    assert data["target_region_found"] is True


def test_sirna_design_avoid_seeds():
    response = client.post(
        "/sirna/design", json={"target_gene": "EGFR", "count": 5, "avoid_seeds": ["UGGCCA"]}
    )
    assert response.status_code == 200
    data = response.json()
    for design in data["designs"]:
        seed = design["sense_strand"][2:8]
        assert seed != "UGGCCA"


def test_aso_design_basic():
    response = client.post(
        "/aso/design", json={"target_rna": "AUGGCGACCCUGGAUGAGCU", "gapmer": True, "count": 3}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["designs"]) == 3
    for design in data["designs"]:
        assert "sequence" in design
        assert "gc_content" in design
        assert "rnase_h_activity" in design
        assert "gapmer_config" in design
        assert design["gapmer_config"]["gap_length"] > 0


def test_aso_design_non_gapmer():
    response = client.post(
        "/aso/design", json={"target_rna": "AUGGCGACCCUGGAUGAGCU", "gapmer": False, "count": 2}
    )
    assert response.status_code == 200
    data = response.json()
    for design in data["designs"]:
        assert design["modification_pattern"] == "PS backbone"
        assert design["gapmer_config"] == {}


def test_mrna_optimize():
    response = client.post(
        "/mrna/optimize",
        json={
            "protein_sequence": "MKTAYIAKQRQISFVKSHFSRQ",
            "codon_optimization": "human",
            "count": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["sequences"]) == 2
    assert "codon_adaptation_index" in data
    assert "gc_content" in data
    assert "predicted_expression" in data
    assert "stability_score" in data
    for seq in data["sequences"]:
        assert "sequence" in seq
        assert "length" in seq
        assert "utr5" in seq
        assert "utr3" in seq
        assert "polyA_tail" in seq


def test_mrna_optimize_different_species():
    for species in ["human", "mouse", "ecoli", "yeast"]:
        response = client.post(
            "/mrna/optimize",
            json={
                "protein_sequence": "MKTAYIAKQRQISFVKSHFSRQ",
                "codon_optimization": species,
                "count": 1,
            },
        )
        assert response.status_code == 200
