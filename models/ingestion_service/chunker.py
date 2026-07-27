import hashlib
from typing import Any

CHROMA_MAX_BYTES = 16 * 1024


def make_source_doc_id(source: str, doc_title: str = "") -> str:
    raw = f"{source}:{doc_title}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def chunk_document(
    text: str,
    metadata: dict[str, Any] | None = None,
    chunk_size: int = 500,
    overlap: int = 50,
    min_chunk: int = 30,
) -> list[dict[str, Any]]:
    if not text or len(text.strip()) < min_chunk:
        return []

    source_doc_id = (metadata or {}).get("source_doc_id") or make_source_doc_id(
        (metadata or {}).get("source", "unknown"),
        (metadata or {}).get("title", ""),
    )
    words = text.split()
    chunks = []
    start = 0
    chunk_index = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_text = " ".join(words[start:end])

        while len(chunk_text.encode("utf-8")) > CHROMA_MAX_BYTES and chunk_size > 100:
            chunk_size = chunk_size // 2
            end = min(start + chunk_size, len(words))
            chunk_text = " ".join(words[start:end])

        if len(chunk_text.strip()) >= min_chunk:
            meta = dict(metadata or {})
            meta["source_doc_id"] = source_doc_id
            meta["chunk_index"] = chunk_index
            chunks.append({
                "text": chunk_text,
                "chunk_index": chunk_index,
                "metadata": meta,
            })
            chunk_index += 1

        if end == len(words):
            break
        start = end - overlap

    return chunks


def chunk_documents(
    docs: list[dict[str, Any]],
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[dict[str, Any]]:
    all_chunks = []
    for doc in docs:
        text = doc.get("text", "") or doc.get("content", "") or doc.get("title", "")
        meta = {k: v for k, v in doc.items() if k not in ("text", "content")}
        if "source_doc_id" not in meta:
            meta["source_doc_id"] = make_source_doc_id(
                meta.get("source", "unknown"),
                meta.get("title", ""),
            )
        chunks = chunk_document(text, meta, chunk_size, overlap)
        all_chunks.extend(chunks)
    return all_chunks
