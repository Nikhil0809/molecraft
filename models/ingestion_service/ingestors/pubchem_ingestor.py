import httpx
import urllib.parse

PUGREST = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"


async def fetch_compound_by_name(name: str) -> list[dict]:
    docs = []
    try:
        encoded = urllib.parse.quote(name, safe="")
        async with httpx.AsyncClient(timeout=30) as client:
            cid_url = f"{PUGREST}/compound/name/{encoded}/cids/JSON"
            resp = await client.get(cid_url)
            if resp.status_code != 200:
                return docs
            cids = resp.json().get("IdentifierList", {}).get("CID", [])
            if not cids:
                return docs
            cid = cids[0]
            detail_url = f"{PUGREST}/compound/cid/{cid}/JSON"
            detail_resp = await client.get(detail_url)
            if detail_resp.status_code != 200:
                return docs
            data = detail_resp.json()
            props = data.get("PC_Compounds", [{}])[0].get("props", [])
            title = ""
            formula = ""
            mw = ""
            smiles = ""
            for p in props:
                urn = p.get("urn", {}).get("label", "")
                val = p.get("value", {}).get("sval", "")
                if urn == "IUPAC Name":
                    title = val
                elif urn == "Molecular Formula":
                    formula = val
                elif urn == "Molecular Weight":
                    mw = val
                elif urn == "SMILES":
                    smiles = val
            doc_text = (
                f"PubChem Compound: {title}. "
                f"Molecular Formula: {formula}. Molecular Weight: {mw}. "
                f"Canonical SMILES: {smiles}."
            )
            docs.append({
                "text": doc_text,
                "source": "PubChem",
                "cid": str(cid),
                "title": title or name,
                "url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}",
            })
    except Exception as e:
        print(f"[PubChemIngestor] Error: {e}")
    return docs


async def ingest(query: str) -> list[dict]:
    return await fetch_compound_by_name(query)


async def ingest_bulk(queries: list[str]) -> list[dict]:
    all_docs = []
    for q in queries:
        docs = await ingest(q)
        all_docs.extend(docs)
    return all_docs
