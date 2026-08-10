import os

import httpx

PATENT_API_URL = os.environ.get("PATENT_API_URL", "http://localhost:8060")


async def search(query: str, depth: str = "normal") -> dict:
    is_deep = depth in ("deep", "ultra")
    max_results = 8 if is_deep else 4

    citations = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{PATENT_API_URL}/search",
                json={
                    "query": query,
                    "max_results": max_results,
                    "date_range": [2020, 2026],
                },
            )
            if resp.status_code != 200:
                return {"status": "empty", "result_count": 0, "citations": [], "tier": 2}

            data = resp.json()
            patents = data.get("patents", [])
            for p in patents[:max_results]:
                citations.append(
                    {
                        "source": "PatentDB",
                        "title": f"{p['patent_number']}: {p['title']} ({p['assignee']})",
                        "year": p.get("year", 2024),
                        "url": f"https://patents.google.com/patent/{p['patent_number']}/",
                        "tier": 2,
                    }
                )

        return {
            "status": "done" if citations else "empty",
            "result_count": len(citations),
            "citations": citations,
            "tier": 2,
        }

    except Exception as e:
        print(f"[PatentDB] Search error: {e}")
        return {"status": "error", "result_count": 0, "citations": [], "tier": 2}
