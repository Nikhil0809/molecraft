import json
import math
import random
import time
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors

app = FastAPI(title="OmniMole Lab Automation & Synthesis", version="1.0.0")

REAGENT_LIBRARY: list[dict] = [
    {"smiles": "CCCOC1=CC=C(C=C1)C(=O)O", "name": "4-Propoxybenzoic acid", "price_per_g": 12.50, "vendor": "Sigma"},
    {"smiles": "CC1=C(C=C(C=C1)S(=O)(=O)N)C(F)(F)F", "name": "4-Amino-2-(trifluoromethyl)benzenesulfonamide", "price_per_g": 45.00, "vendor": "Enamine"},
    {"smiles": "C1=CC2=C(C=C1)C=CN2", "name": "Carbazole", "price_per_g": 8.00, "vendor": "Sigma"},
    {"smiles": "CC(C)(C)OC(=O)N1CCC2=CC=CC=C2C1", "name": "N-Boc-indoline", "price_per_g": 55.00, "vendor": "Combi-Blocks"},
    {"smiles": "C1=CN(C(=O)OCC2=CC=CC=C2)C3=C1C=CC=C3", "name": "Cbz-indole", "price_per_g": 62.00, "vendor": "Fluorochem"},
    {"smiles": "CC1=CC=C(C=C1)S(=O)(=O)Cl", "name": "4-Toluenesulfonyl chloride", "price_per_g": 3.50, "vendor": "Sigma"},
    {"smiles": "C1=CC(=C(C=C1)F)F", "name": "1,2-Difluorobenzene", "price_per_g": 2.80, "vendor": "Sigma"},
    {"smiles": "CC(C)(C)OC(=O)N1CCNCC1", "name": "N-Boc-piperazine", "price_per_g": 18.00, "vendor": "Combi-Blocks"},
    {"smiles": "CCOC(=O)C1=CC=CN1", "name": "Ethyl pyrrole-2-carboxylate", "price_per_g": 14.00, "vendor": "TCI"},
    {"smiles": "NC(=O)C1=CC=C(C=C1)C(F)(F)F", "name": "4-(Trifluoromethyl)benzamide", "price_per_g": 22.00, "vendor": "Apollo"},
]

ROBOTIC_PLATFORMS: list[str] = ["ChemSpeed SWING", "Opentrons OT-2", "Synple S1", "Chemspeed ISYNTH", "Unchained Labs"]


class RetrosynthesisRequest(BaseModel):
    smiles: str = Field(..., description="Target molecule SMILES")
    max_depth: int = Field(default=3, ge=1, le=6)
    available_reagents: list[str] = Field(default=[])


class RetrosynthesisStep(BaseModel):
    depth: int
    reaction_type: str
    precursors: list[str]
    conditions: str
    yield_estimate: float
    cost_per_gram: float


class RetrosynthesisResponse(BaseModel):
    target: str
    routes: list[dict]
    best_route: dict
    estimated_cost: float
    synthetic_accessibility_score: float
    inference_ms: float


class SynthesisPlanRequest(BaseModel):
    smiles: str = Field(..., description="Molecule to synthesize")
    route_index: int = Field(default=0)
    scale_mg: int = Field(default=100, ge=1, le=10000)


class SynthesisStep(BaseModel):
    step_number: int
    reaction: str
    reagents: list[dict]
    conditions: str
    duration_hours: float
    yield_percent: float
    purification: str
    robot_program: str


class SynthesisPlanResponse(BaseModel):
    smiles: str
    total_steps: int
    steps: list[SynthesisStep]
    total_yield: float
    estimated_time_hours: float
    reagent_cost: float
    robot_compatible: bool
    recommended_platform: str
    protocol_json: dict


class ReactionPredictionRequest(BaseModel):
    reactants: list[str] = Field(..., min_length=1, max_length=4)
    conditions: str = Field(default="default")


class ReactionProduct(BaseModel):
    product_smiles: str
    confidence: float
    mechanism: str
    byproducts: list[str]
    conditions: str


class ReactionPredictionResponse(BaseModel):
    reactants: list[str]
    predicted_products: list[ReactionProduct]
    inference_ms: float


class OrderRequest(BaseModel):
    smiles: str = Field(..., description="SMILES to find vendors for")
    quantity_mg: int = Field(default=100)
    max_price: float = Field(default=0)


class VendorListing(BaseModel):
    smiles: str
    name: str
    vendor: str
    catalog_id: str
    price_per_g: float
    stock_status: str
    lead_time_days: int
    shipping_estimate: float


class OrderResponse(BaseModel):
    smiles: str
    listings: list[VendorListing]
    cheapest_option: VendorListing
    fastest_option: VendorListing
    can_synthesize: bool
    synthesis_alternative: str


def assess_synthetic_accessibility(smiles: str) -> tuple[float, list[dict]]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return 10.0, []
    try:
        from rdkit.Chem import BRICS
        fragments = list(BRICS.BRICSDecompose(mol))
    except Exception:
        fragments = []
    n_rings = Descriptors.RingCount(mol)
    n_chiral = len(Chem.FindMolChiralCenters(mol))
    n_het = Descriptors.NumHeteroatoms(mol)
    n_rot = Descriptors.NumRotatableBonds(mol)

    score = 1.0
    score += n_rings * 0.5
    score += n_chiral * 1.0
    score += n_het * 0.3
    score += max(0, n_rot - 5) * 0.2
    score -= min(1.0, len(fragments) * 0.2)
    sa = round(max(1.0, min(10.0, score)), 2)

    routes = []
    if fragments:
        routes.append({"depth": 1, "reaction_type": "BRICS disconnection", "precursors": list(set(fragments))[:5],
                        "conditions": "Standard BRICS retrosynthesis", "yield_estimate": round(0.3 + 0.4 * random.random(), 2),
                        "cost_per_gram": round(50 + len(fragments) * 20, 2)})
    routes.append({"depth": 1, "reaction_type": "Functional group interconversion", "precursors": ["Custom building block"],
                    "conditions": "Literature search required", "yield_estimate": 0.5, "cost_per_gram": 150.0})
    return sa, routes


@app.post("/retrosynthesis", response_model=RetrosynthesisResponse)
def retrosynthesis(req: RetrosynthesisRequest):
    start = time.time()
    sa, routes = assess_synthetic_accessibility(req.smiles)

    return RetrosynthesisResponse(
        target=req.smiles,
        routes=routes,
        best_route=routes[0] if routes else {},
        estimated_cost=routes[0]["cost_per_gram"] if routes else 0,
        synthetic_accessibility_score=sa,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/plan-synthesis", response_model=SynthesisPlanResponse)
def plan_synthesis(req: SynthesisPlanRequest):
    start = time.time()
    mol = Chem.MolFromSmiles(req.smiles)
    if mol is None:
        raise HTTPException(400, "Invalid SMILES")

    mw = Descriptors.MolWt(mol)
    n_steps = max(1, int(3 * mw / 500))

    steps = []
    for i in range(n_steps):
        reagents = random.sample(REAGENT_LIBRARY, min(2, len(REAGENT_LIBRARY)))
        steps.append(SynthesisStep(
            step_number=i + 1,
            reaction=["Buchwald-Hartwig coupling", "Amide coupling", "Suzuki coupling", "SNAr", "Reductive amination", "Ester hydrolysis"][i % 6],
            reagents=[{"smiles": r["smiles"], "name": r["name"], "amount_mg": req.scale_mg // n_steps} for r in reagents],
            conditions=f"{random.choice(['DMF', 'THF', 'DCM', 'Toluene', 'DMSO'])}, {random.choice(['RT', '50°C', '80°C', 'reflux'])}, {random.choice(['2h', '4h', 'overnight', '16h'])}",
            duration_hours=round(random.uniform(2, 16), 1),
            yield_percent=round(random.uniform(40, 95), 1),
            purification=random.choice(["Column chromatography", "Recrystallization", "Prep-HPLC", "Extraction", "Distillation"]),
            robot_program=f"protoc_auto_{uuid.uuid4().hex[:8]}",
        ))

    total_yield = round(math.prod(s.yield_percent / 100 for s in steps) * 100, 1)
    total_time = round(sum(s.duration_hours for s in steps), 1)
    total_cost = round(n_steps * 45.0 + req.scale_mg * 0.5, 2)

    protocol = {
        "molecule": req.smiles,
        "scale_mg": req.scale_mg,
        "steps": [{"step": s.step_number, "reaction": s.reaction, "duration_h": s.duration_hours} for s in steps],
        "total_yield_percent": total_yield,
        "total_duration_h": total_time,
    }

    platform = random.choice(ROBOTIC_PLATFORMS)

    return SynthesisPlanResponse(
        smiles=req.smiles,
        total_steps=n_steps,
        steps=steps,
        total_yield=total_yield,
        estimated_time_hours=total_time,
        reagent_cost=total_cost,
        robot_compatible=True,
        recommended_platform=platform,
        protocol_json=protocol,
    )


@app.post("/predict-reaction", response_model=ReactionPredictionResponse)
def predict_reaction(req: ReactionPredictionRequest):
    start = time.time()
    products = []
    for i, smi in enumerate(req.reactants):
        mol = Chem.MolFromSmiles(smi)
        if mol:
            product = Chem.MolToSmiles(mol)
            products.append(ReactionProduct(
                product_smiles=product,
                confidence=round(0.7 + 0.2 * random.random(), 3),
                mechanism=random.choice(["SN2", "SNAr", "Cross-coupling", "Amide bond formation", "Reductive amination"]),
                byproducts=[f"byproduct_{i}_1", f"byproduct_{i}_2"],
                conditions=req.conditions or f"Standard conditions at {random.randint(25, 100)}°C",
            ))

    return ReactionPredictionResponse(
        reactants=req.reactants,
        predicted_products=products,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/order", response_model=OrderResponse)
def order_compound(req: OrderRequest):
    start = time.time()
    listings = []
    for i in range(min(5, len(REAGENT_LIBRARY))):
        r = REAGENT_LIBRARY[i]
        price = r["price_per_g"]
        if req.max_price > 0 and price > req.max_price:
            continue
        listings.append(VendorListing(
            smiles=r["smiles"],
            name=r["name"],
            vendor=r["vendor"],
            catalog_id=f"CAT-{r['vendor'][:3].upper()}-{random.randint(1000, 9999)}",
            price_per_g=price,
            stock_status=random.choice(["in_stock", "limited", "backorder"]),
            lead_time_days=random.randint(1, 14),
            shipping_estimate=round(random.uniform(15, 75), 2),
        ))

    cheapest = min(listings, key=lambda l: l.price_per_g) if listings else None
    fastest = min(listings, key=lambda l: l.lead_time_days) if listings else None

    return OrderResponse(
        smiles=req.smiles,
        listings=listings,
        cheapest_option=cheapest,
        fastest_option=fastest,
        can_synthesize=bool(listings),
        synthesis_alternative="Custom synthesis via contract research organization" if not listings else "",
    )


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0", "platforms": ROBOTIC_PLATFORMS}
