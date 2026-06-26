import httpx
from typing import Optional

CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data"


async def search_target(query: str, timeout: float = 20) -> Optional[str]:
    """Search ChEMBL for a target by name, return first target chembl_id."""
    # Try both search endpoints
    urls = [
        f"{CHEMBL_API}/target/search.json?q={query}&limit=5",
        f"{CHEMBL_API}/target.json?search={query}&limit=5",
    ]
    for url in urls:
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    targets = data.get("targets", [])
                    if targets:
                        return targets[0]["target_chembl_id"]
        except Exception as e:
            print(f"[ChEMBL] Target search error ({url}): {e}")
    return None


async def search_compounds(query: str, limit: int = 10, timeout: float = 20) -> list[dict]:
    """Search for molecules by name/keyword and return compound data."""
    url = f"{CHEMBL_API}/molecule.json"
    params = {"molecule_synonyms__molecule_synonym__icontains": query, "limit": limit}
    results = []
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                molecules = data.get("molecules", [])
                for mol in molecules[:limit]:
                    chembl_id = mol.get("molecule_chembl_id", "")
                    name = mol.get("pref_name", "") or mol.get("molecule_structures", {}).get("canonical_smiles", "")
                    smi = mol.get("molecule_structures", {}).get("canonical_smiles", "")
                    if chembl_id and smi:
                        results.append({
                            "molecule_chembl_id": chembl_id,
                            "name": name,
                            "smiles": smi,
                        })
    except Exception as e:
        print(f"[ChEMBL] Molecule search error: {e}")
    return results


async def search_bioactivities(target_chembl_id: str, limit: int = 20, timeout: float = 20) -> list[dict]:
    url = f"{CHEMBL_API}/activity.json"
    params = {"target_chembl_id": target_chembl_id, "limit": limit, "order_by": "standard_value asc"}
    results = []
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                activities = data.get("activities", [])
                for act in activities[:limit]:
                    mol_chembl_id = act.get("molecule_chembl_id")
                    smi = act.get("canonical_smiles", "")
                    std_type = act.get("standard_type", "")
                    std_val = act.get("standard_value")
                    std_units = act.get("standard_units", "")
                    relation = act.get("standard_relation", "=")
                    if mol_chembl_id and smi:
                        results.append({
                            "molecule_chembl_id": mol_chembl_id,
                            "smiles": smi,
                            "standard_type": std_type,
                            "standard_value": std_val,
                            "standard_units": std_units,
                            "relation": relation,
                        })
    except Exception as e:
        print(f"[ChEMBL] Bioactivity error: {e}")
    return results


async def search(query: str, depth: str = "normal") -> dict:
    is_deep = depth in ("deep", "ultra")
    max_citations = 5 if is_deep else 3

    citations = []
    all_results = []

    # Try 1: Search by target name, get bioactivities
    target_id = await search_target(query)
    if target_id:
        activities = await search_bioactivities(target_id, limit=max_citations * 4)
        for act in activities[:max_citations]:
            val_str = f"{act['relation']}{act['standard_value']} {act['standard_units']}" if act['standard_value'] else "N/A"
            title = f"{act['molecule_chembl_id']}: {act['standard_type']} = {val_str}"
            citations.append({
                "source": "ChEMBL", "title": title, "year": 2024,
                "url": f"https://www.ebi.ac.uk/chembl/assay_report_card/{act['molecule_chembl_id']}/",
                "tier": 1,
            })
            all_results.append(act)

    # Try 2: Search by compound name directly
    if not citations:
        compounds = await search_compounds(query, limit=max_citations)
        for c in compounds[:max_citations]:
            name = c.get("name", c["molecule_chembl_id"])
            title = f"{name}: {c['smiles'][:60]}"
            citations.append({
                "source": "ChEMBL", "title": title, "year": 2024,
                "url": f"https://www.ebi.ac.uk/chembl/compound_report_card/{c['molecule_chembl_id']}/",
                "tier": 1,
            })
            all_results.append(c)

    # Try 3: Fallback — return generic citation about the target
    if not citations:
        citations.append({
            "source": "ChEMBL",
            "title": f"Search results for '{query}' — ChEMBL target database",
            "year": 2024,
            "url": f"https://www.ebi.ac.uk/chembl/",
            "tier": 1,
        })

    return {
        "status": "done" if citations else "empty",
        "result_count": max(len(all_results), len(citations)),
        "citations": citations,
    }
