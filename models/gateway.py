import importlib.util
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize the API Gateway
app = FastAPI(
    title="MoleCraft Unified API Gateway",
    description="A single entry point for all 18 MoleCraft microservices",
    version="1.0.0"
)

# Configure CORS on the gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# List of all 18 microservices and their main entry files relative to the models directory
SERVICES = [
    ("generative", "generative/main.py"),
    ("affinity_predictor", "affinity_predictor/main.py"),
    ("rag_pipeline", "rag_pipeline/main.py"),
    ("docking", "docking/main.py"),
    ("proteochem", "proteochem/main.py"),
    ("foundation_models", "foundation_models/main.py"),
    ("admet_ml", "admet_ml/main.py"),
    ("molecule_qa", "molecule_qa/main.py"),
    ("omics_discovery", "omics_discovery/main.py"),
    ("ingestion_service", "ingestion_service/main.py"),
    ("antibody_design", "antibody_design/main.py"),
    ("protac_design", "protac_design/main.py"),
    ("rna_design", "rna_design/main.py"),
    ("peptide_design", "peptide_design/main.py"),
    ("clinical_trial", "clinical_trial/main.py"),
    ("lab_automation", "lab_automation/main.py"),
    ("physics_sim", "physics_sim/main.py"),
    ("patent_ip", "patent_ip/main.py"),
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Add all service directories to sys.path so their internal relative and absolute imports work correctly
for name, rel_path in SERVICES:
    dir_path = os.path.join(BASE_DIR, os.path.dirname(rel_path))
    if dir_path not in sys.path:
        sys.path.insert(0, dir_path)

# Dynamically load and mount each sub-app under /<service_name>
for name, rel_path in SERVICES:
    full_path = os.path.join(BASE_DIR, rel_path)
    if not os.path.exists(full_path):
        print(f"[Gateway] Warning: Service path not found: {full_path}")
        continue
    try:
        # Load the module dynamically
        spec = importlib.util.spec_from_file_location(name, full_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        
        # Get the sub-app from the module and mount it
        sub_app = getattr(module, "app")
        app.mount(f"/{name}", sub_app)
        print(f"[Gateway] Successfully mounted service: /{name}")
    except Exception as e:
        print(f"[Gateway] Error loading service {name}: {e}")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "gateway": True,
        "mounted_services": [name for name, rel_path in SERVICES if os.path.exists(os.path.join(BASE_DIR, rel_path))]
    }
