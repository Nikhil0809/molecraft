import httpx
import os

CLINICAL_API_URL = os.environ.get("CLINICAL_API_URL", "http://localhost:8030")


async def search(query: str, depth: str = "normal") -> dict:
    is_deep = depth in ("deep", "ultra")
    max_results = 6 if is_deep else 3

    citations = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{CLINICAL_API_URL}/design-trial",
                json={
                    "disease": query,
                    "drug_name": "OMNI-SEARCH",
                    "mechanism": "small_molecule_inhibitor",
                    "expected_effect_size": 0.3,
                    "phase": "phase2",
                    "sample_size": 100,
                },
            )
            if resp.status_code != 200:
                return {"status": "empty", "result_count": 0, "citations": [], "tier": 2}

            data = resp.json()
            citations.append({
                "source": "ClinicalTrials",
                "title": f"Simulated trial for '{query}': Phase {data.get('phase', 'N/A')}, Power={data.get('power', 0)}, Success Prob={data.get('predicted_success_probability', 0)}",
                "year": 2025,
                "url": f"https://clinicaltrials.gov/search?term={query}",
                "tier": 2,
            })

            for arm in data.get("arms", [])[:max_results]:
                citations.append({
                    "source": "ClinicalTrials",
                    "title": f"Arm: {arm['arm_name']} (n={arm['sample_size']}, effect={arm.get('effect_size', 0)}, p={arm.get('p_value', 0)})",
                    "year": 2025,
                    "url": f"https://clinicaltrials.gov/search?term={query}",
                    "tier": 2,
                })

        return {
            "status": "done" if citations else "empty",
            "result_count": len(citations),
            "citations": citations,
            "tier": 2,
        }

    except Exception as e:
        print(f"[ClinicalTrials] Search error: {e}")
        return {"status": "error", "result_count": 0, "citations": [], "tier": 2}
