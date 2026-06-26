import httpx
import asyncio
import urllib.parse
from typing import Optional

PUGREST = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"


async def search(query: str, depth: str = "normal") -> dict:
    is_deep = depth in ("deep", "ultra")
    max_results = 10 if is_deep else 5

    citations = []
    cids = []

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            # Strategy 1: Try exact compound name lookup
            encoded = urllib.parse.quote(query, safe="")
            search_url = f"{PUGREST}/compound/name/{encoded}/cids/JSON"
            resp = await client.get(search_url)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    cids = data.get("IdentifierList", {}).get("CID", [])
                except Exception:
                    cids = []

            # Strategy 2: Try full text search (handles multi-word queries, drugs, targets)
            if not cids:
                text_url = f"{PUGREST}/compound/textsearch/JSON?text={encoded}"
                resp2 = await client.get(text_url)
                if resp2.status_code == 200:
                    try:
                        data2 = resp2.json()
                        cids = data2.get("IdentifierList", {}).get("CID", [])
                    except Exception:
                        cids = []

            # Strategy 3: Try quick search / autocomplete
            if not cids:
                quick_url = f"{PUGREST}/compound/quicksearch/{encoded}/cids/JSON"
                resp3 = await client.get(quick_url)
                if resp3.status_code == 200:
                    try:
                        data3 = resp3.json()
                        cids = data3.get("IdentifierList", {}).get("CID", [])
                    except Exception:
                        cids = []

            if not cids:
                return {"status": "empty", "result_count": 0, "citations": []}

            result_count = len(cids)
            cids_subset = cids[:max_results]

            cid_str = ",".join(map(str, cids_subset))
            prop_url = f"{PUGREST}/compound/cid/{cid_str}/property/Title,MolecularFormula,MolecularWeight,CanonicalSMILES/JSON"
            prop_resp = await client.get(prop_url)
            if prop_resp.status_code != 200:
                return {"status": "error", "result_count": result_count, "citations": []}

            prop_data = prop_resp.json()
            props = prop_data.get("PropertyTable", {}).get("Properties", [])

            for p in props:
                cid = p.get("CID", "")
                title = p.get("Title", "Unknown")
                formula = p.get("MolecularFormula", "")
                mw = p.get("MolecularWeight", "")

                desc = f"{title}"
                if formula:
                    desc += f" ({formula}, MW: {mw})"

                citations.append({
                    "source": "PubChem",
                    "title": desc,
                    "year": 2024,
                    "url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}",
                    "tier": 1,
                })

        return {
            "status": "done" if citations else "empty",
            "result_count": result_count,
            "citations": citations,
        }

    except Exception as e:
        print(f"[PubChem] Search error: {e}")
        return {"status": "error", "result_count": 0, "citations": []}
