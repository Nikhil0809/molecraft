import asyncio
import json
import os
import time
import uuid
from collections import OrderedDict

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sources import (
    chembl,
    clinical_trials,
    patent,
    pubchem,
    pubmed,
    tavily,
    uniprot,
    web_search,
    wikipedia,
)

app = FastAPI(title="MoleCraft RAG Pipeline", version="2.0.0")

PUBMED_API_KEY = os.environ.get("PUBMED_API_KEY", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
INGESTION_API_URL = os.environ.get("INGESTION_API_URL", "http://localhost:8011")


class RAGRequest(BaseModel):
    query: str = Field(..., description="Search query (target protein, disease, SMILES)")
    depth: str = Field(default="normal", pattern="^(normal|deep|ultra)$")
    citation_tier: str = Field(default="all", pattern="^(all|t1_t2|t1)$")
    pubmed_api_key: str | None = None


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


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., description="Semantic search query")
    n_results: int = Field(default=10, ge=1, le=50)


class GroqReasonRequest(BaseModel):
    query: str = Field(..., description="User question")
    context_chunks: list[dict] = Field(default_factory=list, description="Retrieved context chunks")
    model: str = Field(default="llama-3.3-70b-versatile", description="Groq model ID")
    n_results: int = Field(default=10, ge=1, le=50, description="Number of semantic search results")
    history: list[dict] = Field(
        default_factory=list,
        description="Prior conversation turns as [{'role': 'user'|'assistant', 'content': str}]",
    )


class GroqReasonResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    answer: str
    model_used: str
    chunks_used: int


# ── In-memory cache with TTL ──────────────────────────────────────────────


class TTLCache:
    def __init__(self, ttl_seconds: int = 300, max_size: int = 128):
        self._ttl = ttl_seconds
        self._max = max_size
        self._store: OrderedDict[str, tuple[float, RAGResponse]] = OrderedDict()

    def _key(self, req: RAGRequest) -> str:
        return f"{req.query}::depth={req.depth}::tier={req.citation_tier}"

    def get(self, req: RAGRequest) -> RAGResponse | None:
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

SourceDef = tuple[str, int, str]
TIER1_SOURCES: list[SourceDef] = [
    ("ChEMBL", 1, ""),
    ("PubMed", 1, ""),
    ("PubChem", 1, ""),
    ("UniProt", 1, ""),
]
TIER2_SOURCES: list[SourceDef] = [
    ("PatentDB", 2, "PATENT_API_URL"),
    ("ClinicalTrials", 2, "CLINICAL_API_URL"),
]
TIER3_SOURCES: list[SourceDef] = [
    ("Tavily", 3, "TAVILY_API_KEY"),
    ("Wikipedia", 3, ""),
    ("WebSearch", 3, ""),
]


def _get_sources(citation_tier: str) -> list[SourceDef]:
    sources = list(TIER1_SOURCES)
    if citation_tier in ("all", "t1_t2"):
        sources.extend(TIER2_SOURCES)
    if citation_tier in ("all",):
        for name, tier, dep in TIER3_SOURCES:
            if not dep or (dep == "TAVILY_API_KEY" and TAVILY_API_KEY):
                sources.append((name, tier, dep))
    return sources


SEARCH_FN = {
    "ChEMBL": chembl.search,
    "PubMed": pubmed.search,
    "PubChem": pubchem.search,
    "UniProt": uniprot.search,
    "PatentDB": patent.search,
    "ClinicalTrials": clinical_trials.search,
    "Tavily": tavily.search,
    "Wikipedia": wikipedia.search,
    "WebSearch": web_search.search,
}


# ── ChromaDB / Ingestion helpers ──────────────────────────────────────────


async def _semantic_search(query: str, n_results: int = 10) -> list[dict]:
    if not INGESTION_API_URL:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{INGESTION_API_URL}/search",
                json={"query": query, "n_results": n_results},
            )
            if resp.is_success:
                data = resp.json()
                return data.get("results", [])
    except Exception as e:
        print(f"[RAG] Semantic search error: {e}")
    return []


SYSTEM_PROMPT = (
    "You are MoleCraft AI, a precise scientific assistant specialized in molecular design, "
    "drug discovery, and computational chemistry. Answer concisely and accurately based on "
    "the research context provided. Cite sources where relevant. If the context doesn't have "
    "enough information, say so and provide your best scientific knowledge."
)


def _build_messages(query: str, context: str, history: list[dict] | None) -> list[dict]:
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in (history or [])[-8:]:
        role = str(turn.get("role", "")).lower()
        content = turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content})
    user_prompt = query
    if context:
        user_prompt = f"Research Context:\n{context}\n\nQuestion: {query}"
    messages.append({"role": "user", "content": user_prompt})
    return messages


async def _groq_reason(
    query: str,
    context: str,
    model: str = "llama-3.3-70b-versatile",
    history: list[dict] | None = None,
) -> str:
    if not GROQ_API_KEY:
        return "Groq API key not configured."

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": _build_messages(query, context, history),
                    "temperature": 0,
                    "max_tokens": 2048,
                },
            )
            if resp.is_success:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[RAG] Groq error: {e}")

    return ""


async def _groq_reason_stream(
    query: str,
    context: str,
    model: str = "llama-3.3-70b-versatile",
    history: list[dict] | None = None,
):
    """Stream tokens from Groq API via SSE."""
    if not GROQ_API_KEY:
        yield f"data: {json.dumps({'error': 'Groq API key not configured'})}\n\n"
        return

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": _build_messages(query, context, history),
                    "temperature": 0,
                    "max_tokens": 2048,
                    "stream": True,
                },
            ) as resp:
                if resp.is_success:
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                yield f"data: {json.dumps({'done': True})}\n\n"
                                return
                            try:
                                chunk = json.loads(data_str)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield f"data: {json.dumps({'token': content})}\n\n"
                            except json.JSONDecodeError:
                                pass
                else:
                    yield f"data: {json.dumps({'error': f'Groq API error: {resp.status_code}'})}\n\n"
    except Exception as e:
        print(f"[RAG] Groq stream error: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


# ── Endpoints ─────────────────────────────────────────────────────────────


@app.post("/search")
async def search(req: RAGRequest) -> RAGResponse:
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    cached = _cache.get(req)
    if cached is not None:
        return cached

    api_key = req.pubmed_api_key or PUBMED_API_KEY
    active_sources = _get_sources(req.citation_tier)

    start = time.time()

    tasks = {}
    for name, _, _ in active_sources:
        fn = SEARCH_FN[name]
        if name == "PubMed":
            tasks[name] = fn(query, req.depth, api_key)
        else:
            tasks[name] = fn(query, req.depth)

    results = await asyncio.gather(
        *[tasks[n] for n, _, _ in active_sources], return_exceptions=True
    )

    elapsed = time.time() - start

    source_results: dict[str, dict] = {}
    for (name, _, _), res in zip(active_sources, results, strict=False):
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
        sources.append(
            SourceResult(
                name=name,
                status=status,
                result_count=count,
                tier=tier,
                message=f"{message} ({elapsed:.1f}s)",
            )
        )

    all_citations = []
    for name, tier, _ in active_sources:
        res = source_results[name]
        for cit in res.get("citations", []):
            all_citations.append(
                CitationResult(
                    id=str(uuid.uuid4()),
                    source=cit["source"],
                    title=cit["title"],
                    year=cit.get("year", 2024),
                    url=cit.get("url", ""),
                    tier=cit.get("tier", tier),
                )
            )

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


@app.post("/semantic-search")
async def semantic_search(req: SemanticSearchRequest):
    results = await _semantic_search(req.query, req.n_results)
    return {
        "query": req.query,
        "count": len(results),
        "results": results,
    }


@app.post("/reason")
async def reason(req: GroqReasonRequest) -> GroqReasonResponse:
    if not GROQ_API_KEY:
        return GroqReasonResponse(
            answer=(
                "A Groq API key is not configured, so model-based reasoning is unavailable. "
                f"The query was: {req.query}. Set GROQ_API_KEY to enable full answers."
            ),
            model_used="fallback",
            chunks_used=0,
        )

    chunks_text = []
    for i, chunk in enumerate(req.context_chunks[:10]):
        text = chunk.get("text", "") or chunk.get("document", "")
        source = chunk.get("metadata", {}).get("source", chunk.get("source", "unknown"))
        score = chunk.get("distance", chunk.get("score", 0))
        if isinstance(score, float):
            score_str = f"{score:.3f}"
        else:
            score_str = str(score)
        chunks_text.append(f"[{i+1}] Source: {source} (relevance: {score_str})\n{text}")

    context = "\n\n".join(chunks_text) if chunks_text else ""

    answer = await _groq_reason(req.query, context, req.model, req.history)

    if not answer:
        answer = "I could not generate a complete answer with the available context."

    return GroqReasonResponse(
        answer=answer,
        model_used=req.model,
        chunks_used=len(chunks_text),
    )


@app.post("/query")
async def query_endpoint(req: GroqReasonRequest) -> GroqReasonResponse:
    semantic_results = await _semantic_search(req.query, req.n_results or 10)
    chunks = semantic_results or req.context_chunks
    req.context_chunks = chunks
    return await reason(req)


@app.post("/query/stream")
async def query_stream_endpoint(req: GroqReasonRequest):
    """Stream tokens from Groq reasoning with semantic search context."""
    if not GROQ_API_KEY:
        raise HTTPException(503, "Groq API key not configured")

    semantic_results = await _semantic_search(req.query, req.n_results or 10)
    chunks = semantic_results or req.context_chunks

    chunks_text = []
    for i, chunk in enumerate(chunks[:10]):
        text = chunk.get("text", "") or chunk.get("document", "")
        source = chunk.get("metadata", {}).get("source", chunk.get("source", "unknown"))
        score = chunk.get("distance", chunk.get("score", 0))
        if isinstance(score, float):
            score_str = f"{score:.3f}"
        else:
            score_str = str(score)
        chunks_text.append(f"[{i+1}] Source: {source} (relevance: {score_str})\n{text}")

    context = "\n\n".join(chunks_text) if chunks_text else ""

    return StreamingResponse(
        _groq_reason_stream(req.query, context, req.model, req.history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "cache_size": len(_cache._store),
        "tavily_configured": bool(TAVILY_API_KEY),
        "groq_configured": bool(GROQ_API_KEY),
        "ingestion_configured": bool(INGESTION_API_URL),
    }
