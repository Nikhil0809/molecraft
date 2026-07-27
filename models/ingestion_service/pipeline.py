import time
from cleaner import clean_text
from deduplicator import Deduplicator
from chunker import chunk_documents
from chroma_store import store_chunks


def run_pipeline(
    raw_docs: list[dict],
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> dict:
    start = time.time()

    for doc in raw_docs:
        if "text" in doc:
            doc["text"] = clean_text(doc["text"])
        if "content" in doc:
            doc["content"] = clean_text(doc["content"])

    dedup = Deduplicator()
    unique_docs = dedup.filter(raw_docs)

    chunks = chunk_documents(unique_docs, chunk_size, chunk_overlap)

    stored = store_chunks(chunks)

    elapsed = time.time() - start
    return {
        "status": "ok",
        "input_docs": len(raw_docs),
        "unique_docs": len(unique_docs),
        "chunks": len(chunks),
        "stored": stored,
        "elapsed_seconds": round(elapsed, 2),
    }
