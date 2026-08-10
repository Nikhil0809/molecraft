import xml.etree.ElementTree as ET

import httpx

ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"


async def search(query: str, depth: str = "normal", api_key: str = "") -> dict:
    is_deep = depth in ("deep", "ultra")
    max_results = 10 if is_deep else 5

    citations = []

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            # Search
            params = {
                "db": "pubmed",
                "term": f"({query}) AND (drug[MeSH] OR pharmacology[MeSH] OR therapy[MeSH])",
                "retmax": max_results,
                "retmode": "json",
                "sort": "relevance",
            }
            if api_key:
                params["api_key"] = api_key

            resp = await client.get(ESEARCH, params=params)
            if resp.status_code != 200:
                # Fallback: simple query
                params["term"] = query
                resp = await client.get(ESEARCH, params=params)

            if resp.status_code != 200:
                return {"status": "error", "result_count": 0, "citations": []}

            search_data = resp.json()
            id_list = search_data.get("esearchresult", {}).get("idlist", [])
            result_count = len(id_list)

            if not id_list:
                return {"status": "empty", "result_count": 0, "citations": []}

            # Fetch summaries using efetch (more reliable XML format)
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(id_list[:max_results]),
                "retmode": "xml",
                "rettype": "abstract",
            }
            if api_key:
                fetch_params["api_key"] = api_key

            fetch_resp = await client.get(ESUMMARY, params=fetch_params)
            if fetch_resp.status_code != 200:
                return {"status": "error", "result_count": result_count, "citations": []}

            # Parse XML: eSummaryResult -> DocSum
            root = ET.fromstring(fetch_resp.text)
            for docsum in root.findall("DocSum"):
                uid = docsum.findtext("Id", "")
                title = ""
                source = "PubMed"
                year = 2024

                for item in docsum.findall("Item"):
                    item_name = item.get("Name", "")
                    if item_name == "Title":
                        title = item.text or ""
                    elif item_name == "Source":
                        source = item.text or "PubMed"
                    elif item_name == "PubDate":
                        date_str = item.text or ""
                        if date_str and len(date_str) >= 4:
                            try:
                                year = int(date_str[:4])
                            except ValueError:
                                pass
                    elif item_name == "EPubDate":
                        if not title:
                            title = "PubMed article"

                if title:
                    citations.append(
                        {
                            "source": source,
                            "title": title[:200],
                            "year": year,
                            "url": f"https://pubmed.ncbi.nlm.nih.gov/{uid}/",
                            "tier": 1,
                        }
                    )

        return {
            "status": "done" if citations else "empty",
            "result_count": result_count,
            "citations": citations,
        }

    except Exception as e:
        print(f"[PubMed] Error: {e}")
        return {"status": "error", "result_count": 0, "citations": []}
