import asyncio
import time
import uuid
import os
from typing import Optional
from collections import OrderedDict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from sources import chembl, pubmed, pubchem, uniprot, tavily

app = FastAPI(title="MoleCraft RAG Pipeline", version="1.1.0")

PUBMED_API_KEY = os.environ.get("PUBMED_API_KEY", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")


class RAGRequest(BaseModel):
    query: str = Field(..., description="Search query (target protein, disease, SMILES)")
    depth: str = Field(default="normal", pattern="^(normal|deep|ultra)$")
    citation_tier: str = Field(default="all", pattern="^(all|t1_t2|t1)$")
    pubmed_api_key: Optional[str] = None


class SourceResult(BaseModel):
    name: str
    status: str
    result_count: int
    tier: int
    message: str


class CitationResult(BaseModel):
    id: str
    source: str
    title: str
    year: int
    url: str
    tier: int


class RAGResponse(BaseModel):
    sources: list[SourceResult]
    citations: list[CitationResult]


def should_include_tier(citation_tier: str, citation_tier_val: int) -> bool:
    if citation_tier == "all":
        return True
    if citation_tier == "t1_t2":
        return citation_tier_val in (1, 2)
    if citation_tier == "t1":
        return citation_tier_val == 1
    return True


# ── In-memory cache with TTL ──────────────────────────────────────────────

class TTLCache:
    def __init__(self, ttl_seconds: int = 300, max_size: int = 128):
        self._ttl = ttl_seconds
        self._max = max_size
        self._store: OrderedDict[str, tuple[float, RAGResponse]] = OrderedDict()

    def _key(self, req: RAGRequest) -> str:
        return f"{req.query}::depth={req.depth}::tier={req.citation_tier}"

    def get(self, req: RAGRequest) -> Optional[RAGResponse]:
        key = self._key(req)
        entry = self._store.get(key)
        if entry is None:
            return None
        ts, resp = entry
        if time.time() - ts > self._ttl:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return resp

    def set(self, req: RAGRequest, resp: RAGResponse) -> None:
        key = self._key(req)
        self._store[key] = (time.time(), resp)
        self._store.move_to_end(key)
        while len(self._store) > self._max:
            self._store.popitem(last=False)


_cache = TTLCache()


# ── Source registry ───────────────────────────────────────────────────────

SourceDef = tuple[str, int, str]  # (name, tier, dependency_set)
TIER1_SOURCES: list[SourceDef] = [
    ("ChEMBL", 1, ""),
    ("PubMed", 1, ""),
    ("PubChem", 1, ""),
    ("UniProt", 1, ""),
]
TIER3_SOURCES: list[SourceDef] = [
    ("Tavily", 3, "TAVILY_API_KEY"),
]


def _get_sources(citation_tier: str) -> list[SourceDef]:
    sources = list(TIER1_SOURCES)
    if citation_tier in ("all",):
        if TAVILY_API_KEY:
            sources.extend(TIER3_SOURCES)
    return sources


SEARCH_FN = {
    "ChEMBL": chembl.search,
    "PubMed": pubmed.search,
    "PubChem": pubchem.search,
    "UniProt": uniprot.search,
    "Tavily": tavily.search,
}


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.post("/search")
async def search(req: RAGRequest) -> RAGResponse:
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    # Check cache
    cached = _cache.get(req)
    if cached is not None:
        return cached

    api_key = req.pubmed_api_key or PUBMED_API_KEY
    active_sources = _get_sources(req.citation_tier)

    start = time.time()

    tasks = {}
    for name, tier, dep_env in active_sources:
        fn = SEARCH_FN[name]
        if name == "PubMed":
            tasks[name] = fn(query, req.depth, api_key)
        else:
            tasks[name] = fn(query, req.depth)

    results = await asyncio.gather(*[tasks[n] for n, _, _ in active_sources], return_exceptions=True)

    elapsed = time.time() - start

    source_results: dict[str, dict] = {}
    for (name, tier, _), res in zip(active_sources, results):
        if isinstance(res, Exception):
            print(f"[{name}] Exception: {res}")
            source_results[name] = {"status": "error", "result_count": 0, "citations": []}
        else:
            source_results[name] = res

    sources = []
    for name, tier, _ in active_sources:
        res = source_results[name]
        status = res.get("status", "error")
        count = res.get("result_count", 0)
        messages = {
            "done": f"{count} results retrieved",
            "empty": f"No results from {name}",
            "error": f"{name} query failed",
        }
        message = messages.get(status, f"{name}: {status}")
        sources.append(SourceResult(
            name=name, status=status, result_count=count, tier=tier,
            message=f"{message} ({elapsed:.1f}s)",
        ))

    all_citations = []
    for name, tier, _ in active_sources:
        res = source_results[name]
        for cit in res.get("citations", []):
            if should_include_tier(req.citation_tier, cit.get("tier", tier)):
                all_citations.append(CitationResult(
                    id=str(uuid.uuid4()),
                    source=cit["source"],
                    title=cit["title"],
                    year=cit.get("year", 2024),
                    url=cit.get("url", ""),
                    tier=cit.get("tier", tier),
                ))

    # Deduplicate citations by URL
    seen_urls: set[str] = set()
    unique_citations: list[CitationResult] = []
    for c in all_citations:
        normalized = c.url.lower().strip()
        if normalized and normalized in seen_urls:
            continue
        if normalized:
            seen_urls.add(normalized)
        unique_citations.append(c)

    max_citations = 15 if req.depth in ("deep", "ultra") else 8
    unique_citations = unique_citations[:max_citations]

    response = RAGResponse(sources=sources, citations=unique_citations)
    _cache.set(req, response)
    return response


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "cache_size": len(_cache._store),
        "tavily_configured": bool(TAVILY_API_KEY),
    }
