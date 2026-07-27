import httpx
import urllib.parse

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"


async def search(query: str, depth: str = "normal") -> dict:
    is_deep = depth in ("deep", "ultra")
    max_results = 5 if is_deep else 3

    citations = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": max_results,
                "format": "json",
                "srprop": "snippet|titlesnippet",
            }
            resp = await client.get(WIKIPEDIA_API, params=params)
            if resp.status_code != 200:
                return {"status": "empty", "result_count": 0, "citations": [], "tier": 3}

            data = resp.json()
            results = data.get("query", {}).get("search", [])

            for r in results:
                title = r.get("title", "Unknown")
                page_id = r.get("pageid", "")
                snippet = r.get("snippet", "")

                full_title = f"{title} - {snippet[:120].replace('<span class=\"searchmatch\">', '').replace('</span>', '')}..." if snippet else title

                citations.append({
                    "source": "Wikipedia",
                    "title": full_title[:250],
                    "year": 2025,
                    "url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                    "tier": 3,
                })

        return {
            "status": "done" if citations else "empty",
            "result_count": len(citations),
            "citations": citations,
            "tier": 3,
        }

    except Exception as e:
        print(f"[Wikipedia] Search error: {e}")
        return {"status": "error", "result_count": 0, "citations": [], "tier": 3}
