import os
import urllib.parse

import httpx

TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")


async def search(query: str, depth: str = "normal") -> dict:
    if not TAVILY_API_KEY:
        return {"status": "empty", "result_count": 0, "citations": [], "tier": 3}

    is_deep = depth in ("deep", "ultra")
    max_results = 8 if is_deep else 5

    citations = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "advanced" if is_deep else "basic",
                    "include_answer": False,
                    "include_raw_content": False,
                },
            )
            if resp.status_code != 200:
                return {"status": "empty", "result_count": 0, "citations": [], "tier": 3}

            data = resp.json()
            results = data.get("results", [])
            encoded_query = urllib.parse.quote(query)
            for r in results:
                title = r.get("title", "Unknown")
                content = r.get("content", "")
                citations.append(
                    {
                        "source": "Tavily",
                        "title": f"{title} — {content[:120]}" if content else title,
                        "year": 2025,
                        "url": f"https://www.ebi.ac.uk/chembl/explore/target?search={encoded_query}",
                        "tier": 3,
                    }
                )

        return {
            "status": "done" if citations else "empty",
            "result_count": len(citations),
            "citations": citations,
            "tier": 3,
        }

    except Exception as e:
        print(f"[Tavily] Search error: {e}")
        return {"status": "error", "result_count": 0, "citations": [], "tier": 3}
