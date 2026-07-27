import httpx
from bs4 import BeautifulSoup


async def fetch_page_text(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "MoleCraft/1.0"})
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "lxml")
                for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                    tag.decompose()
                text = soup.get_text(separator=" ")
                return " ".join(text.split())[:10000]
    except Exception as e:
        print(f"[WebSearchIngestor] Error fetching {url}: {e}")
    return None


async def ingest(urls: list[str]) -> list[dict]:
    docs = []
    for url in urls:
        text = await fetch_page_text(url)
        if text:
            docs.append({
                "text": text,
                "source": "web",
                "url": url,
                "metadata": {"url": url, "source": "web"},
            })
    return docs
