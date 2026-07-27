import httpx
import urllib.parse
import xml.etree.ElementTree as ET

PUBMED_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_FETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


async def search_articles(query: str, max_results: int = 10, api_key: str = "") -> list[dict]:
    docs = []
    try:
        encoded = urllib.parse.quote(query, safe="")
        api_param = f"&api_key={api_key}" if api_key else ""
        async with httpx.AsyncClient(timeout=30) as client:
            search_url = (
                f"{PUBMED_SEARCH}?db=pubmed&term={encoded}&retmax={max_results}"
                f"&retmode=json{api_param}"
            )
            sresp = await client.get(search_url)
            if sresp.status_code != 200:
                return docs
            id_list = sresp.json().get("esearchresult", {}).get("idlist", [])
            if not id_list:
                return docs
            ids = ",".join(id_list)
            fetch_url = (
                f"{PUBMED_FETCH}?db=pubmed&id={ids}&retmode=xml{api_param}"
            )
            fresp = await client.get(fetch_url)
            if fresp.status_code != 200:
                return docs
            root = ET.fromstring(fresp.text)
            for article in root.findall(".//PubmedArticle"):
                medline = article.find(".//MedlineCitation")
                if medline is None:
                    continue
                art = medline.find(".//Article")
                if art is None:
                    continue
                title_el = art.find("ArticleTitle")
                title = "".join(title_el.itertext()) if title_el is not None else "No title"
                abstract_el = art.find("Abstract/AbstractText")
                abstract = "".join(abstract_el.itertext()) if abstract_el is not None else ""
                pmid = medline.findtext("PMID", "")
                doc_text = f"Title: {title}\nAbstract: {abstract}" if abstract else f"Title: {title}"
                docs.append({
                    "text": doc_text,
                    "source": "PubMed",
                    "pmid": pmid,
                    "title": title,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                })
    except Exception as e:
        print(f"[PubMedIngestor] Error: {e}")
    return docs


async def ingest(query: str) -> list[dict]:
    return await search_articles(query)
