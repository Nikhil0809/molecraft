import math
import random
import time
import uuid
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="OmniMole Clinical Trial Simulation", version="1.0.0")

DISEASE_BASELINES: dict[str, dict] = {
    "alzheimer": {"prevalence": 0.1, "annual_decline": 3.0, "placebo_response": 0.3, "mortality": 0.02},
    "parkinson": {"prevalence": 0.02, "annual_decline": 2.5, "placebo_response": 0.25, "mortality": 0.01},
    "lung_cancer": {"prevalence": 0.005, "annual_decline": 15.0, "placebo_response": 0.15, "mortality": 0.3},
    "heart_failure": {"prevalence": 0.03, "annual_decline": 8.0, "placebo_response": 0.2, "mortality": 0.15},
    "diabetes_t2": {"prevalence": 0.09, "annual_decline": 1.5, "placebo_response": 0.35, "mortality": 0.005},
}

HISTORICAL_SUCCESS_RATES: dict[str, float] = {
    "oncology": 0.034,
    "cns": 0.061,
    "cardiovascular": 0.072,
    "metabolic": 0.085,
    "immunology": 0.112,
    "infectious_disease": 0.145,
}


class DigitalTwinPatient(BaseModel):
    patient_id: str
    age: int
    sex: str
    bmi: float
    biomarkers: dict[str, float]
    comorbidities: list[str]
    genetic_risk: float
    predicted_placebo_response: float
    predicted_drug_response: float
    dropout_risk: float
    adverse_event_risk: float


class TrialArm(BaseModel):
    arm_name: str
    patients: list[DigitalTwinPatient]
    sample_size: int
    dropout_rate: float
    mean_baseline: float
    mean_endpoint: float
    effect_size: float
    p_value: float


class TrialDesignRequest(BaseModel):
    disease: str = Field(..., description="Disease indication")
    drug_name: str = Field(default="OMNI-001", description="Drug candidate name")
    mechanism: str = Field(default="small_molecule_inhibitor")
    expected_effect_size: float = Field(default=0.3, ge=0.01, le=0.9)
    phase: str = Field(default="phase1", pattern="^(phase1|phase2|phase3)$")
    sample_size: int = Field(default=100, ge=10, le=10000)
    duration_weeks: int = Field(default=12, ge=4, le=156)
    placebo_ratio: float = Field(default=0.5, ge=0.25, le=0.75)
    biomarker_stratification: bool = Field(default=False)
    adaptive_design: bool = Field(default=False)


class TrialDesignResponse(BaseModel):
    trial_id: str
    drug_name: str
    disease: str
    phase: str
    total_patients: int
    arms: list[TrialArm]
    power: float
    predicted_success_probability: float
    estimated_cost_millions: float
    duration_weeks: int
    primary_endpoint: str
    adaptive_features: list[str]
    inference_ms: float


class PatientSimulationRequest(BaseModel):
    n_patients: int = Field(default=100, ge=10, le=10000)
    age_range: list[int] = Field(default=[40, 80])
    bmi_range: list[float] = Field(default=[18.5, 35])
    disease: str = Field(default="alzheimer")
    drug_effect_mean: float = Field(default=0.5)
    drug_effect_std: float = Field(default=0.2)


class PatientCohortResponse(BaseModel):
    patients: list[DigitalTwinPatient]
    cohort_statistics: dict
    synthetic_data_generated: bool
    inference_ms: float


class BayesianAdaptiveRequest(BaseModel):
    n_interim_analyses: int = Field(default=3, ge=1, le=10)
    prior_effect_mean: float = Field(default=0.0)
    prior_effect_std: float = Field(default=0.3)
    expected_effect: float = Field(default=0.3)
    n_total: int = Field(default=200)


class BayesianAdaptiveResponse(BaseModel):
    stopping_boundaries: list[dict]
    expected_savings: int
    operating_characteristics: dict
    recommended_interim_timing: list[int]


class DrugRepurposingRequest(BaseModel):
    drug_smiles: str = Field(..., description="SMILES of the drug")
    disease: str = Field(default="", description="Disease to evaluate")
    known_targets: list[str] = Field(default=[])


class DrugRepurposingResponse(BaseModel):
    drug: str
    predicted_indications: list[dict]
    similarity_to_approved: list[dict]
    repurposing_confidence: float
    off_target_risks: list[str]


def generate_patient(rng: np.random.Generator, age_range: list[int], bmi_range: list[float], disease: str) -> DigitalTwinPatient:
    age = int(rng.uniform(age_range[0], age_range[1]))
    sex = rng.choice(["M", "F"])
    bmi = round(float(rng.uniform(bmi_range[0], bmi_range[1])), 1)

    baseline = DISEASE_BASELINES.get(disease, DISEASE_BASELINES["alzheimer"])
    genetic = round(float(rng.beta(2, 5)), 3)

    biomarkers = {}
    if disease == "alzheimer":
        biomarkers["amyloid_beta"] = round(float(rng.uniform(200, 1200)), 1)
        biomarkers["tau_ptau181"] = round(float(rng.uniform(10, 100)), 1)
        biomarkers["hippocampal_volume"] = round(float(rng.uniform(2000, 4000)), 1)
        biomarkers["mmse_baseline"] = round(float(rng.uniform(18, 28)), 1)
    elif disease == "lung_cancer":
        biomarkers["pdl1_tps"] = round(float(rng.uniform(0, 100)), 1)
        biomarkers["tmb"] = round(float(rng.uniform(0, 50)), 1)
        biomarkers["ctdna"] = round(float(rng.uniform(0, 100)), 1)
    elif disease == "heart_failure":
        biomarkers["nt_probnp"] = round(float(rng.uniform(100, 5000)), 1)
        biomarkers["lv_ejection_fraction"] = round(float(rng.uniform(15, 55)), 1)
        biomarkers["creatinine"] = round(float(rng.uniform(0.5, 2.0)), 2)

    n_comorbidities = int(rng.poisson(2))
    comorbidity_pool = ["hypertension", "diabetes", "hyperlipidemia", "copd", "ckd", "anemia", "depression", "afib"]
    comorbidities = list(rng.choice(comorbidity_pool, size=min(n_comorbidities, len(comorbidity_pool)), replace=False))

    placebo = round(float(min(1.0, max(0.0, baseline["placebo_response"] + rng.normal(0, 0.1)))), 3)
    drug = round(float(min(1.0, max(0.0, 0.5 - baseline["placebo_response"] / 2 + rng.normal(0, 0.15)))), 3)
    dropout = round(float(min(0.4, baseline["mortality"] * 3 + rng.uniform(0, 0.1))), 3)
    ae = round(float(min(0.8, baseline["mortality"] * 5 + rng.uniform(0, 0.2))), 3)

    return DigitalTwinPatient(
        patient_id=str(uuid.uuid4()),
        age=age, sex=sex, bmi=bmi,
        biomarkers=biomarkers,
        comorbidities=comorbidities,
        genetic_risk=genetic,
        predicted_placebo_response=placebo,
        predicted_drug_response=drug,
        dropout_risk=dropout,
        adverse_event_risk=ae,
    )


@app.post("/design-trial", response_model=TrialDesignResponse)
def design_trial(req: TrialDesignRequest):
    start = time.time()
    trial_id = f"OMNI-{req.phase.upper()}-{str(uuid.uuid4())[:8]}"

    rng = np.random.default_rng(random.seed(hash(f"{req.drug_name}_{req.disease}_{time.time()}") % (2**31)))
    baseline = DISEASE_BASELINES.get(req.disease, DISEASE_BASELINES["alzheimer"])

    n_placebo = int(req.sample_size * req.placebo_ratio)
    n_treatment = req.sample_size - n_placebo

    placebo_patients = [generate_patient(rng, [40, 80], [18.5, 35], req.disease) for _ in range(n_placebo)]
    treatment_patients = [generate_patient(rng, [40, 80], [18.5, 35], req.disease) for _ in range(n_treatment)]

    dropout_rate = baseline["mortality"] + 0.05

    placebo_mean = sum(p.predicted_placebo_response for p in placebo_patients) / max(n_placebo, 1)
    treatment_mean = sum(p.predicted_drug_response for p in treatment_patients) / max(n_treatment, 1)

    effect = treatment_mean - placebo_mean + req.expected_effect_size * 0.5
    p_val = round(float(min(0.5, max(0.001, 0.05 * (1 - effect / 0.5)))), 4)

    arms = [
        TrialArm(
            arm_name="Placebo",
            patients=placebo_patients[:10],
            sample_size=n_placebo,
            dropout_rate=dropout_rate,
            mean_baseline=baseline["annual_decline"],
            mean_endpoint=round(baseline["annual_decline"] * (1 - placebo_mean), 2),
            effect_size=round(placebo_mean, 4),
            p_value=round(0.5 + 0.1 * np.random.random(), 4),
        ),
        TrialArm(
            arm_name=f"{req.drug_name} ({req.mechanism})",
            patients=treatment_patients[:10],
            sample_size=n_treatment,
            dropout_rate=dropout_rate * 1.2,
            mean_baseline=baseline["annual_decline"],
            mean_endpoint=round(baseline["annual_decline"] * (1 - treatment_mean - effect), 2),
            effect_size=round(treatment_mean + effect, 4),
            p_value=p_val,
        ),
    ]

    z_stat = effect / (0.2 / math.sqrt(req.sample_size))
    power = round(float(min(0.99, 0.5 + 0.5 * math.erf(z_stat / math.sqrt(2)))), 3)

    disease_category = "oncology" if "cancer" in req.disease else "cns" if req.disease in ("alzheimer", "parkinson") else "cardiovascular"
    historical_rate = HISTORICAL_SUCCESS_RATES.get(disease_category, 0.06)
    predicted_success = round(float(min(0.9, historical_rate * (1 + power) * (1 + req.expected_effect_size))), 3)

    if req.phase == "phase1":
        cost = round(5 + 15 * np.random.random(), 1)
    elif req.phase == "phase2":
        cost = round(20 + 50 * np.random.random(), 1)
    else:
        cost = round(100 + 200 * np.random.random(), 1)

    adaptive = []
    if req.adaptive_design:
        adaptive = ["sample_size_reestimation", "futility_stopping", "bayesian_borrowing"]
    if req.biomarker_stratification:
        adaptive.append("biomarker_stratification")

    return TrialDesignResponse(
        trial_id=trial_id,
        drug_name=req.drug_name,
        disease=req.disease,
        phase=req.phase,
        total_patients=req.sample_size,
        arms=arms,
        power=power,
        predicted_success_probability=predicted_success,
        estimated_cost_millions=cost,
        duration_weeks=req.duration_weeks,
        primary_endpoint="change_from_baseline",
        adaptive_features=adaptive,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/simulate-patients", response_model=PatientCohortResponse)
def simulate_patients(req: PatientSimulationRequest):
    start = time.time()
    rng = np.random.default_rng(random.randint(0, 2**31))
    patients = [generate_patient(rng, req.age_range, req.bmi_range, req.disease) for _ in range(req.n_patients)]

    stats = {
        "n_patients": len(patients),
        "mean_age": round(sum(p.age for p in patients) / len(patients), 1),
        "sex_ratio_male": round(sum(1 for p in patients if p.sex == "M") / len(patients), 3),
        "mean_bmi": round(sum(p.bmi for p in patients) / len(patients), 1),
        "mean_placebo_response": round(sum(p.predicted_placebo_response for p in patients) / len(patients), 3),
        "mean_dropout_risk": round(sum(p.dropout_risk for p in patients) / len(patients), 3),
        "mean_ae_risk": round(sum(p.adverse_event_risk for p in patients) / len(patients), 3),
    }

    return PatientCohortResponse(
        patients=patients[:50],
        cohort_statistics=stats,
        synthetic_data_generated=True,
        inference_ms=round((time.time() - start) * 1000, 1),
    )


@app.post("/bayesian-adaptive", response_model=BayesianAdaptiveResponse)
def bayesian_adaptive_design(req: BayesianAdaptiveRequest):
    start = time.time()
    n_per_interim = req.n_total // (req.n_interim_analyses + 1)

    boundaries = []
    for i in range(1, req.n_interim_analyses + 1):
        n_enrolled = n_per_interim * i
        z_boundary = round(float(1.96 - 0.3 * math.log(i + 1)), 3)
        futility = round(float(-0.5 + 0.1 * i), 3)
        efficacy = round(float(z_boundary * 0.3), 3)
        boundaries.append({
            "interim": i,
            "n_enrolled": n_enrolled,
            "z_boundary": z_boundary,
            "futility_boundary": futility,
            "efficacy_boundary": efficacy,
            "information_fraction": round(n_enrolled / req.n_total, 3),
        })

    savings = int(req.n_total * 0.15 * req.n_interim_analyses)

    return BayesianAdaptiveResponse(
        stopping_boundaries=boundaries,
        expected_savings=savings,
        operating_characteristics={
            "type_1_error": round(0.025 + 0.005 * req.n_interim_analyses, 3),
            "power": round(0.8 + 0.03 * req.expected_effect, 3),
            "expected_n_under_null": req.n_total - savings,
            "probability_early_stop": round(0.3 + 0.1 * req.expected_effect, 3),
        },
        recommended_interim_timing=[n_per_interim * i for i in range(1, req.n_interim_analyses + 1)],
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "diseases": list(DISEASE_BASELINES.keys()),
        "phases": ["phase1", "phase2", "phase3"],
    }
