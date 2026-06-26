import httpx

UNIPROT_API = "https://rest.uniprot.org/uniprotkb"


def disambiguate_query(query: str) -> str:
    q = query.strip()
    if q.upper().startswith("COX"):
        return q.replace("COX-2", "cyclooxygenase-2").replace("COX2", "cyclooxygenase-2").replace("COX-1", "cyclooxygenase-1").replace("COX1", "cyclooxygenase-1")
    if q.upper().startswith("EGFR"):
        return "epidermal growth factor receptor " + q
    if "braf" in q.lower() or "b-raf" in q.lower():
        return "serine threonine kinase BRAF " + q
    if q.upper().startswith("ACE2"):
        return "angiotensin converting enzyme 2 " + q
    if q.upper().startswith("HER2"):
        return "receptor tyrosine kinase erbB2 " + q
    return q


async def search(query: str, depth: str = "normal") -> dict:
    is_deep = depth in ("deep", "ultra")
    max_results = 5 if is_deep else 3

    citations = []
    disambiguated = disambiguate_query(query)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "query": disambiguated,
                "size": max_results,
                "fields": "accession,id,protein_name,gene_names,organism_name,cc_function",
            }
            resp = await client.get(f"{UNIPROT_API}/search", params=params)
            if resp.status_code != 200:
                return {"status": "empty", "result_count": 0, "citations": []}

            data = resp.json()
            results = data.get("results", [])
            result_count = len(results)

            for r in results:
                accession = r.get("primaryAccession", "")
                name = r.get("proteinDescription", {}).get("recommendedName", {}).get("fullName", {}).get("value", "Unknown protein")
                organism = r.get("organism", {}).get("scientificName", "Unknown")
                gene = ""
                genes = r.get("genes", [])
                if genes:
                    gene = genes[0].get("geneName", {}).get("value", "")

                title = f"{name} ({organism})"
                if gene:
                    title += f" - Gene: {gene}"

                citations.append({
                    "source": "UniProt",
                    "title": title,
                    "year": 2024,
                    "url": f"https://www.uniprot.org/uniprotkb/{accession}/entry",
                    "tier": 1,
                })

        return {
            "status": "done" if citations else "empty",
            "result_count": result_count,
            "citations": citations,
        }

    except Exception as e:
        print(f"[UniProt] Search error: {e}")
        return {"status": "error", "result_count": 0, "citations": []}
