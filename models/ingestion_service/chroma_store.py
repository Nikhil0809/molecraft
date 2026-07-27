import os

CLOUD_ENABLED = os.environ.get("CHROMA_API_KEY", "") and os.environ.get("CHROMA_TENANT", "")

from typing import Optional

if CLOUD_ENABLED:
    from cloud_store import (
        get_or_create_collection,
        store_chunks,
        search_chunks,
        collection_stats,
        list_collections,
        delete_collection,
        is_cloud_configured,
    )
else:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions

    CHROMA_DIR = os.environ.get("CHROMA_DIR", os.path.join(os.path.dirname(__file__), "chroma_db"))
    COLLECTION_NAME = os.environ.get("CHROMA_COLLECTION", "molecule_docs")
    EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "local").lower()

    def _embedding_fn():
        if EMBEDDING_PROVIDER == "openai":
            api_key = os.environ.get("OPENAI_API_KEY", "")
            model = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
            return embedding_functions.OpenAIEmbeddingFunction(
                api_key=api_key,
                model_name=model,
            )
        return embedding_functions.DefaultEmbeddingFunction()

    def get_client():
        return chromadb.PersistentClient(
            path=CHROMA_DIR,
            settings=Settings(anonymized_telemetry=False),
        )

    def get_or_create_collection(client=None):
        if client is None:
            client = get_client()
        return client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=_embedding_fn(),
            metadata={"hnsw:space": "cosine", "embedding_provider": EMBEDDING_PROVIDER},
        )

    def store_chunks(chunks: list[dict]) -> int:
        client = get_client()
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
        client = get_client()
        collection = get_or_create_collection(client)
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        output = []
        if not results["ids"] or not results["ids"][0]:
            return output

        for i in range(len(results["ids"][0])):
            output.append({
                "id": results["ids"][0][i],
                "text": results["documents"][0][i] if results["documents"] else "",
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else 0.0,
            })
        return output

    def collection_stats() -> dict:
        client = get_client()
        collection = get_or_create_collection(client)
        return {
            "name": collection.name,
            "count": collection.count(),
            "chroma_dir": CHROMA_DIR,
            "embedding_provider": EMBEDDING_PROVIDER,
        }

    def list_collections() -> list[dict]:
        client = get_client()
        cols = client.list_collections()
        return [{"name": c.name, "count": c.count()} for c in cols]

    def delete_collection(name: str) -> None:
        client = get_client()
        client.delete_collection(name)

    def is_cloud_configured() -> bool:
        return False
