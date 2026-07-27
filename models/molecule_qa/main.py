import os
import json
from fastapi import FastAPI
from pydantic import BaseModel, Field
import httpx

from chemistry_filter import is_chemistry_related

app = FastAPI(title="MoleCraft Molecule Q&A", version="3.0.0")

RAG_API_URL = os.environ.get("RAG_API_URL", "http://localhost:8002")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "mixtral-8x7b-32768")


class QnARequest(BaseModel):
    query: str = Field(..., description="User's question about molecules")
    context: str = Field("", description="RAG context to ground the answer")
    model: str = Field("", description="Groq model to use")


class QnAResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    answer: str
    confidence: str = "high"
    chemistry_score: float = 0.0
    model_used: str = ""


def _get_rag_context(query: str) -> str:
    try:
        with httpx.Client(timeout=20) as client:
            resp = client.post(
                f"{RAG_API_URL}/search",
                json={"query": query, "depth": "normal", "citation_tier": "t1_t2"},
            )
            if resp.is_success:
                data = resp.json()
                citations = data.get("citations", [])
                sources = data.get("sources", [])
                parts = []
                for s in sources:
                    parts.append(f"[Source: {s['name']}] {s['message']}")
                for c in citations[:8]:
                    parts.append(f"[{c['source']}] {c['title']} ({c['year']})")
                return "\n".join(parts)
    except Exception:
        pass
    return ""


def _get_semantic_context(query: str) -> str:
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{RAG_API_URL}/semantic-search",
                json={"query": query, "n_results": 8},
            )
            if resp.is_success:
                data = resp.json()
                results = data.get("results", [])
                parts = []
                for i, r in enumerate(results[:8]):
                    text = r.get("text", "")
                    meta = r.get("metadata", {})
                    source = meta.get("source", "ChromaDB")
                    score = r.get("distance", 0)
                    parts.append(f"[{i+1}] {source} (score: {score:.3f}): {text}")
                return "\n\n".join(parts)
    except Exception:
        pass
    return ""


def _call_groq(query: str, context: str, model: str) -> str:
    if not GROQ_API_KEY:
        return "Groq API key not configured. Set GROQ_API_KEY environment variable."

    model_name = model or GROQ_MODEL

    system_prompt = (
        "You are MoleCraft AI, a precise scientific assistant specialized in molecular design, "
        "drug discovery, and computational chemistry. Answer concisely and accurately based on "
        "the research context provided. Cite sources where relevant. If the context doesn't have "
        "enough information, say so and provide your best scientific knowledge."
    )

    user_prompt = query
    if context:
        user_prompt = f"Research Context:\n{context}\n\nQuestion: {query}"

    try:
        with httpx.Client(timeout=60) as client:
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0,
                "max_tokens": 2048,
            }
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.is_success:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[MoleculeQA] Groq error: {e}")

    return ""


@app.post("/qna", response_model=QnAResponse)
async def qna(req: QnAResponse) -> QnAResponse:
    is_chem, score, reason = is_chemistry_related(req.query)
    if not is_chem:
        return QnAResponse(
            answer="I specialize in chemistry, molecular design, and drug discovery topics. "
                   f"Your question doesn't appear to be chemistry-related. "
                   f"Please ask about molecules, drugs, targets, or related scientific topics.",
            confidence="low",
            chemistry_score=score,
            model_used="filter",
        )

    context = req.context
    if not context:
        rag_context = _get_rag_context(req.query)
        semantic_context = _get_semantic_context(req.query)
        combined = []
        if rag_context:
            combined.append("=== Database Sources ===\n" + rag_context)
        if semantic_context:
            combined.append("=== Semantic Search Results ===\n" + semantic_context)
        context = "\n\n".join(combined)

    model = req.model or GROQ_MODEL
    answer = _call_groq(req.query, context, model)

    if not answer:
        answer = (
            f"I searched across molecular databases for '{req.query}' but couldn't "
            f"generate a complete answer. Try rephrasing or providing more details."
        )

    return QnAResponse(
        answer=answer,
        confidence="high" if context else "medium",
        chemistry_score=score,
        model_used=model,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL, "groq_configured": bool(GROQ_API_KEY)}
