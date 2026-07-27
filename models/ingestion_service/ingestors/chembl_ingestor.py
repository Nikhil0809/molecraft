import httpx
import urllib.parse

CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data"


async def search_molecules(query: str, max_results: int = 20) -> list[dict]:
    docs = []
    try:
        encoded = urllib.parse.quote(query, safe="")
        async with httpx.AsyncClient(timeout=30) as client:
            url = f"{CHEMBL_API}/molecule.json?q={encoded}&limit={max_results}"
            resp = await client.get(url)
            if resp.status_code != 200:
                return docs
            data = resp.json()
            molecules = data.get("molecules", [])
            for mol in molecules:
                pref_name = mol.get("pref_name", "") or mol.get("chembl_id", "Unknown")
                synonyms = mol.get("molecule_synonyms", [])
                if isinstance(synonyms, list):
                    syn_text = "; ".join(s.get("synonyms", "") for s in synonyms[:5])
                else:
                    syn_text = ""
                smiles = mol.get("molecule_structures", {}).get("canonical_smiles", "")
                doc_text = (
                    f"ChEMBL Molecule: {pref_name}. "
                    f"ChEMBL ID: {mol.get('chembl_id', '')}. "
                    f"Type: {mol.get('molecule_type', '')}. "
                    f"Synonyms: {syn_text}. "
                    f"SMILES: {smiles}."
                )
                docs.append({
                    "text": doc_text,
                    "source": "ChEMBL",
                    "chembl_id": mol.get("chembl_id", ""),
                    "title": pref_name,
                    "url": f"https://www.ebi.ac.uk/chembl/compound_report_card/{mol.get('chembl_id', '')}/",
                })
    except Exception as e:
        print(f"[ChEMBLIngestor] Error: {e}")
    return docs


async def ingest(query: str) -> list[dict]:
    return await search_molecules(query)
