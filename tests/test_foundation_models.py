from conftest import load_service_module
from fastapi.testclient import TestClient

foundation_app = load_service_module("foundation_models").app


client = TestClient(foundation_app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "models" in data


def test_gnn_predict_invalid_smiles():
    response = client.post("/gnn/predict", json={"smiles": "INVALID", "target_protein": "EGFR"})
    assert response.status_code == 400


def test_gnn_predict_valid_smiles():
    response = client.post(
        "/gnn/predict", json={"smiles": "CC(=O)OC1=CC=CC=C1C(=O)O", "target_protein": "EGFR"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert len(data["predictions"]) == 1
    pred = data["predictions"][0]
    assert "affinity_nm" in pred
    assert "confidence" in pred
    assert "attributions" in data
    assert "inference_ms" in data


def test_esm_embed_valid_sequence():
    response = client.post(
        "/esm/embed", json={"sequence": "MKTAYIAKQRQISFVKSHFSRQ", "model_size": "esm2_t12_35M"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "embedding" in data
    assert "embedding_dim" in data
    assert data["embedding_dim"] > 0
    assert "model" in data


def test_esm_embed_empty_sequence():
    response = client.post("/esm/embed", json={"sequence": "", "model_size": "esm2_t12_35M"})
    assert response.status_code == 200
    data = response.json()
    assert "embedding" in data


def test_fold_protein():
    response = client.post("/fold", json={"sequence": "MKTAYIAKQRQISFVKSHFSRQ", "model": "esmfold"})
    assert response.status_code == 200
    data = response.json()
    assert "pdb_content" in data
    assert "confidence" in data
    assert "method" in data
    assert "sequence" in data


def test_molt5_caption():
    response = client.post(
        "/molt5",
        json={
            "task": "caption",
            "input_text": "CC(=O)OC1=CC=CC=C1C(=O)O",
            "num_return_sequences": 3,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "sequences" in data
    assert len(data["sequences"]) <= 3


def test_molt5_generation():
    response = client.post(
        "/molt5",
        json={
            "task": "generation",
            "input_text": "aspirin like molecule",
            "num_return_sequences": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "sequences" in data


def test_molt5_optimization():
    response = client.post(
        "/molt5",
        json={
            "task": "optimization",
            "input_text": "CC(=O)OC1=CC=CC=C1C(=O)O",
            "num_return_sequences": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "sequences" in data
