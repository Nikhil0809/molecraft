from conftest import load_service_module
from fastapi.testclient import TestClient

rag_app = load_service_module("rag_pipeline").app


client = TestClient(rag_app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "cache_size" in data
    assert "tavily_configured" in data
    assert "groq_configured" in data


def test_search_basic():
    response = client.post(
        "/search", json={"query": "EGFR inhibitor", "depth": "normal", "citation_tier": "all"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "sources" in data
    assert "citations" in data
    assert isinstance(data["sources"], list)
    assert isinstance(data["citations"], list)


def test_search_with_tier_filter():
    response = client.post(
        "/search", json={"query": "EGFR", "depth": "deep", "citation_tier": "t1_t2"}
    )
    assert response.status_code == 200
    data = response.json()
    for src in data["sources"]:
        assert src["tier"] in [1, 2]


def test_search_tier1_only():
    response = client.post(
        "/search", json={"query": "EGFR", "depth": "normal", "citation_tier": "t1"}
    )
    assert response.status_code == 200
    data = response.json()
    for src in data["sources"]:
        assert src["tier"] == 1


def test_semantic_search():
    response = client.post("/semantic-search", json={"query": "kinase inhibitor", "n_results": 5})
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "count" in data
    assert "results" in data


def test_reason_without_groq_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    response = client.post(
        "/reason",
        json={"query": "What is EGFR?", "context_chunks": [], "model": "mixtral-8x7b-32768"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "model_used" in data


def test_query_endpoint():
    response = client.post("/query", json={"query": "EGFR inhibitors", "n_results": 5})
    assert response.status_code in [200, 503]
