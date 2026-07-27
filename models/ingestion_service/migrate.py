"""
Migration script: copy data from local ChromaDB to Chroma Cloud.

Usage:
    python migrate.py                          # migrate default collection
    python migrate.py --all                    # migrate all local collections
    python migrate.py --collection my_coll     # migrate specific collection

Requires CHROMA_API_KEY, CHROMA_TENANT env vars set.
"""

import os
import sys
import argparse
import chromadb
from chromadb.config import Settings

LOCAL_CHROMA_DIR = os.environ.get("CHROMA_DIR", os.path.join(os.path.dirname(__file__), "chroma_db"))
BATCH_SIZE = 100


def get_local_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(
        path=LOCAL_CHROMA_DIR,
        settings=Settings(anonymized_telemetry=False),
    )


def get_cloud_store():
    from cloud_store import get_or_create_collection, store_chunks
    return get_or_create_collection, store_chunks


def migrate_collection(local_name: str):
    local = get_local_client()

    try:
        local_coll = local.get_collection(local_name)
    except Exception:
        print(f"  Local collection '{local_name}' not found, skipping.")
        return

    count = local_coll.count()
    if count == 0:
        print(f"  Collection '{local_name}' is empty, skipping.")
        return

    print(f"  Migrating {count} records from '{local_name}'...")

    cloud_coll, cloud_store = get_cloud_store()
    offset = 0
    total = 0

    while offset < count:
        results = local_coll.get(
            limit=BATCH_SIZE,
            offset=offset,
            include=["documents", "metadatas"],
        )
        ids = results.get("ids", [])
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])

        if not ids:
            break

        chunks = []
        for i in range(len(ids)):
            chunks.append({
                "id": ids[i],
                "text": docs[i] if docs and i < len(docs) else "",
                "metadata": metas[i] if metas and i < len(metas) else {},
            })

        stored = cloud_store(chunks)
        total += stored
        offset += BATCH_SIZE
        print(f"    Progress: {total}/{count}")

    print(f"  Done: {total} records migrated.")


def main():
    parser = argparse.ArgumentParser(description="Migrate local ChromaDB to Chroma Cloud")
    parser.add_argument("--collection", type=str, default="", help="Specific collection to migrate")
    parser.add_argument("--all", action="store_true", help="Migrate all collections")
    args = parser.parse_args()

    api_key = os.environ.get("CHROMA_API_KEY", "")
    tenant = os.environ.get("CHROMA_TENANT", "")
    if not api_key or not tenant:
        print("Error: CHROMA_API_KEY and CHROMA_TENANT must be set")
        sys.exit(1)

    local = get_local_client()

    if args.collection:
        migrate_collection(args.collection)
    elif args.all:
        cols = local.list_collections()
        if not cols:
            print("No local collections found.")
            return
        for c in cols:
            migrate_collection(c.name)
    else:
        from chroma_store import COLLECTION_NAME
        migrate_collection(COLLECTION_NAME)

    print("Migration complete.")


if __name__ == "__main__":
    main()
