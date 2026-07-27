import os
import chromadb
from chromadb import CloudClient, Schema
from chromadb.config import Settings
from chromadb.utils.embedding_functions import (
    ChromaCloudQwenEmbeddingFunction,
    ChromaCloudSpladeEmbeddingFunction,
)
from chromadb.utils.embedding_functions.chroma_cloud_qwen_embedding_function import ChromaCloudQwenEmbeddingModel
from chromadb.utils.embedding_functions.chroma_cloud_splade_embedding_function import ChromaCloudSpladeEmbeddingModel
from chromadb import (
    Search, K, Knn, Rrf,
    VectorIndexConfig, SparseVectorIndexConfig,
)
from chromadb.execution.expression.operator import GroupBy, MinK

CHROMA_TENANT = os.environ.get("CHROMA_TENANT", "")
CHROMA_DATABASE = os.environ.get("CHROMA_DATABASE", "molecraft")
CHROMA_API_KEY = os.environ.get("CHROMA_API_KEY", "")
CHROMA_HOST = os.environ.get("CHROMA_HOST", "api.trychroma.com")
COLLECTION_NAME = os.environ.get("CHROMA_COLLECTION", "molecraft")
SPARSE_KEY = "sparse_embedding"


def is_cloud_configured() -> bool:
    return bool(CHROMA_API_KEY) and bool(CHROMA_TENANT)


def get_cloud_client() -> CloudClient:
    return CloudClient(
        tenant=CHROMA_TENANT,
        database=CHROMA_DATABASE,
        api_key=CHROMA_API_KEY,
        cloud_host=CHROMA_HOST,
    )


def _build_schema() -> Schema:
    from chromadb import Schema
    schema = Schema()

    qwen_ef = ChromaCloudQwenEmbeddingFunction(
        model=ChromaCloudQwenEmbeddingModel.QWEN3_EMBEDDING_0p6B,
        task="nl_to_code",
    )
    schema.create_index(config=VectorIndexConfig(
        space="cosine",
        embedding_function=qwen_ef,
    ))

    splade_ef = ChromaCloudSpladeEmbeddingFunction(
        model=ChromaCloudSpladeEmbeddingModel.SPLADE_PP_EN_V1,
    )
    schema.create_index(
        config=SparseVectorIndexConfig(
            source_key=K.DOCUMENT,
            embedding_function=splade_ef,
        ),
        key=SPARSE_KEY,
    )

    return schema


def get_or_create_collection(client=None):
    if client is None:
        client = get_cloud_client()
    schema = _build_schema()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        schema=schema,
    )


def store_chunks(chunks: list[dict]) -> int:
    client = get_cloud_client()
    collection = get_or_create_collection(client)
    existing_count = collection.count()

    ids = []
    documents = []
    metadatas = []

    for chunk in chunks:
        doc_id = chunk.get("id") or f"chunk_{existing_count + len(ids) + 1}"
        ids.append(doc_id)
        documents.append(chunk.get("text", ""))
        metadatas.append(chunk.get("metadata", {}))

    if not ids:
        return 0

    collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
    )
    return len(ids)


def search_chunks(
    query: str,
    n_results: int = 10,
    where: dict | None = None,
) -> list[dict]:
    client = get_cloud_client()
    collection = get_or_create_collection(client)

    dense_rank = Knn(query=query, key="#embedding", return_rank=True, limit=200)
    sparse_rank = Knn(query=query, key=SPARSE_KEY, return_rank=True, limit=200)

    hybrid_rank = Rrf(
        ranks=[dense_rank, sparse_rank],
        weights=[0.7, 0.3],
        k=60,
    )

    search = (
        Search()
        .rank(hybrid_rank)
        .group_by(GroupBy(
            keys=[K("source_doc_id")],
            aggregate=MinK(keys=[K.SCORE], k=1),
        ))
        .limit(n_results)
        .select_all()
    )

    if where:
        search = search.where(where)

    results = collection.search(search)

    output = []
    rows = results.rows()[0] if results and results.rows() else []
    for row in rows:
        meta = dict(row.get("metadata", {}))
        meta.pop("sparse_embedding", None)
        output.append({
            "id": row.get("id", ""),
            "text": row.get("document", ""),
            "metadata": meta,
            "distance": row.get("score", 0.0),
        })
    return output


def search_chunks_by_source(
    query: str,
    source: str,
    n_results: int = 10,
) -> list[dict]:
    return search_chunks(
        query,
        n_results=n_results,
        where={"source": source},
    )


def collection_stats() -> dict:
    client = get_cloud_client()
    collection = get_or_create_collection(client)
    return {
        "name": collection.name,
        "count": collection.count(),
        "cloud_host": CHROMA_HOST,
        "tenant": CHROMA_TENANT,
        "database": CHROMA_DATABASE,
    }


def list_collections() -> list[dict]:
    client = get_cloud_client()
    cols = client.list_collections()
    return [
        {"name": c.name, "count": c.count()}
        for c in cols
    ]


def delete_collection(name: str) -> None:
    client = get_cloud_client()
    client.delete_collection(name)


def health() -> dict:
    if not is_cloud_configured():
        return {"status": "not_configured"}
    try:
        client = get_cloud_client()
        client.heartbeat()
        return {"status": "ok", "cloud_host": CHROMA_HOST}
    except Exception as e:
        return {"status": "error", "error": str(e)}
