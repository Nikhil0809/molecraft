import os
import re
from fastapi import FastAPI
from pydantic import BaseModel, Field
import httpx

app = FastAPI(title="MoleCraft Molecule Q&A", version="1.0.0")

RAG_API_URL = os.environ.get("RAG_API_URL", "http://localhost:8002")


class QnARequest(BaseModel):
    query: str = Field(..., description="User's question about molecules")
    context: str = Field("", description="RAG context to ground the answer")


class QnAResponse(BaseModel):
    answer: str
    confidence: str = "high"


MOLECULE_PATTERNS = {
    r"\bCDK[24]/?6\b": "CDK4/6 inhibitors are used in cancer therapy. Key compounds include palbociclib, ribociclib, and abemaciclib.",
    r"\bPROTAC\b": "PROTACs (Proteolysis Targeting Chimeras) are bifunctional molecules that degrade target proteins via the ubiquitin-proteasome system.",
    r"\bEGFR\b": "EGFR (Epidermal Growth Factor Receptor) inhibitors include gefitinib, erlotinib, and osimertinib for NSCLC treatment.",
    r"\bADMET\b": "ADMET covers Absorption, Distribution, Metabolism, Excretion, and Toxicity — key properties for drug candidate evaluation.",
    r"\bSMILES\b": "SMILES (Simplified Molecular Input Line Entry System) is a notation for encoding molecular structures as ASCII strings.",
    r"\bmolecular dynamics\b": "Molecular dynamics (MD) simulations model atomic movements over time to study protein-ligand interactions.",
    r"\bdocking\b": "Molecular docking predicts the preferred orientation of a ligand when bound to a target protein.",
    r"\bQSAR\b": "QSAR (Quantitative Structure-Activity Relationship) models predict biological activity from molecular structure.",
    r"\bIC5[0]\b": "IC50 is the half-maximal inhibitory concentration — a measure of a compound's potency against a target.",
    r"\bbiologics?\b": "Biologics are large-molecule drugs (antibodies, proteins) produced from living organisms.",
}


def _get_rag_context(query: str) -> str:
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{RAG_API_URL}/search",
                json={"query": query, "depth": "normal", "citation_tier": "all"},
            )
            if resp.is_success:
                data = resp.json()
                citations = data.get("citations", [])
                sources = data.get("sources", [])
                parts = []
                for s in sources:
                    parts.append(f"[Source: {s['name']}] {s['message']}")
                for c in citations[:5]:
                    parts.append(f"[{c['source']}] {c['title']} ({c['year']})")
                return "\n".join(parts)
    except Exception:
        pass
    return ""


def _generate_answer(query: str, context: str) -> str:
    for pattern, answer in MOLECULE_PATTERNS.items():
        if re.search(pattern, query, re.IGNORECASE):
            if context:
                return f"{answer}\n\nRelated research:\n{context}"
            return answer

    if context and "Source:" in context:
        return (
            f"Based on available molecular databases, here's what I found:\n\n"
            f"{context}\n\n"
            f"For more detailed information, try specifying a target protein, SMILES, or disease."
        )

    return (
        "I can help answer questions about molecular design, drug discovery, and computational chemistry. "
        "Try asking about specific targets (e.g., EGFR, CDK4/6), concepts (PROTAC, docking, ADMET), "
        "or molecules using SMILES notation."
    )


@app.post("/qna", response_model=QnAResponse)
async def qna(req: QnARequest) -> QnAResponse:
    context = req.context

    if not context:
        rag_context = _get_rag_context(req.query)
        context = rag_context

    answer = _generate_answer(req.query, context)
    return QnAResponse(answer=answer)


@app.get("/health")
async def health():
    return {"status": "ok"}
