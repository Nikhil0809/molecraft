import html as html_mod
import re

import httpx

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


async def search(query: str, depth: str = "normal") -> dict:
    is_deep = depth in ("deep", "ultra")
    max_results = 8 if is_deep else 5

    citations = []
    try:
        async with httpx.AsyncClient(timeout=15, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": f"{query} chemistry drug molecule"},
            )
            if resp.status_code != 200:
                return {"status": "empty", "result_count": 0, "citations": [], "tier": 3}

            body = resp.text
            results = re.findall(
                r'<a rel="nofollow" class="result__a" href="(.*?)".*?>(.*?)</a>.*?'
                r'<a class="result__snippet".*?>(.*?)</a>',
                body,
                re.DOTALL,
            )

            for url, title_html, snippet_html in results[:max_results]:
                title = re.sub(r"<.*?>", "", title_html).strip()
                snippet = re.sub(r"<.*?>", "", snippet_html).strip()
                title = html_mod.unescape(title)
                snippet = html_mod.unescape(snippet[:200])

                citations.append(
                    {
                        "source": "Web",
                        "title": f"{title} — {snippet}" if snippet else title,
                        "year": 2025,
                        "url": url,
                        "tier": 3,
                    }
                )

            if not citations:
                fallback_resp = await client.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": query},
                )
                if fallback_resp.status_code == 200:
                    fallback_body = fallback_resp.text
                    fallback_results = re.findall(
                        r'<a rel="nofollow" class="result__a" href="(.*?)".*?>(.*?)</a>.*?'
                        r'<a class="result__snippet".*?>(.*?)</a>',
                        fallback_body,
                        re.DOTALL,
                    )
                    for url, title_html, snippet_html in fallback_results[:max_results]:
                        title = re.sub(r"<.*?>", "", title_html).strip()
                        snippet = re.sub(r"<.*?>", "", snippet_html).strip()
                        title = html_mod.unescape(title)
                        snippet = html_mod.unescape(snippet[:200])
                        citations.append(
                            {
                                "source": "Web",
                                "title": f"{title} — {snippet}" if snippet else title,
                                "year": 2025,
                                "url": url,
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
        print(f"[WebSearch] Error: {e}")
        return {"status": "error", "result_count": 0, "citations": [], "tier": 3}
