from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

from pipeline import run_pipeline
from chroma_store import search_chunks, collection_stats, list_collections, delete_collection, is_cloud_configured
from ingestors import pubchem_ingestor, chembl_ingestor, pubmed_ingestor
from ingestors.sds_ingestor import ingest_sds_text

app = FastAPI(title="MoleCraft Ingestion Service", version="2.0.0")


class IngestRequest(BaseModel):
    text: str = Field("", description="Raw text to ingest")
    source: str = Field("manual", description="Source label")
    metadata: dict = Field(default_factory=dict)


class SourceIngestRequest(BaseModel):
    query: str = Field(..., description="Search query for the source")
    source: str = Field(..., description="Source type: pubchem, chembl, pubmed")


class SearchRequest(BaseModel):
    query: str = Field(..., description="Semantic search query")
    n_results: int = Field(default=10, ge=1, le=50)
    where: Optional[dict] = None


@app.post("/ingest")
async def ingest_text(req: IngestRequest):
    if not req.text.strip():
        raise HTTPException(400, "Text cannot be empty")
    docs = [{"text": req.text, "source": req.source, **req.metadata}]
    result = run_pipeline(docs)
    return result


@app.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = content.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(400, "Could not decode file as text")

    docs = [{"text": text, "source": "file_upload", "filename": file.filename or "unknown"}]
    result = run_pipeline(docs)
    return result


@app.post("/ingest/source")
async def ingest_from_source(req: SourceIngestRequest):
    source_map = {
        "pubchem": pubchem_ingestor.ingest,
        "chembl": chembl_ingestor.ingest,
        "pubmed": pubmed_ingestor.ingest,
    }
    ingestor = source_map.get(req.source.lower())
    if not ingestor:
        raise HTTPException(400, f"Unknown source: {req.source}. Use: {list(source_map.keys())}")

    docs = await ingestor(req.query)
    if not docs:
        return {"status": "empty", "source": req.source, "query": req.query, "docs_found": 0}

    result = run_pipeline(docs)
    result["source"] = req.source
    result["query"] = req.query
    result["docs_found"] = len(docs)
    return result


@app.post("/ingest/sds")
async def ingest_sds(req: IngestRequest):
    docs = ingest_sds_text(req.text, {"source": req.source, **(req.metadata)})
    result = run_pipeline(docs)
    return result


@app.post("/search")
async def search(req: SearchRequest):
    results = search_chunks(req.query, req.n_results, req.where)
    return {
        "query": req.query,
        "results_count": len(results),
        "results": results,
    }


@app.get("/stats")
async def stats():
    return collection_stats()


@app.get("/collections")
async def list_all_collections():
    return {"collections": list_collections()}


@app.delete("/collections/{name}")
async def remove_collection(name: str):
    delete_collection(name)
    return {"status": "deleted", "collection": name}


@app.get("/health")
async def health():
    cloud = is_cloud_configured()
    return {
        "status": "ok",
        "service": "ingestion",
        "cloud_configured": cloud,
    }
