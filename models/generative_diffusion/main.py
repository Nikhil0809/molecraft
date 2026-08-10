import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router, initialize_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    checkpoint_path = os.environ.get("MOLDiff_CHECKPOINT", "./model/checkpoints/moldiff.pt")
    property_checkpoint = os.environ.get("PROPERTY_CHECKPOINT", "./model/checkpoints/property_head.pt")
    patent_db_path = os.environ.get("PATENT_DB_PATH")
    unified_predictor_url = os.environ.get("UNIFIED_PREDICTOR_URL", "http://localhost:8001")
    
    await initialize_model(
        checkpoint_path=checkpoint_path,
        property_checkpoint=property_checkpoint,
        patent_db_path=patent_db_path,
        unified_predictor_url=unified_predictor_url
    )
    
    yield
    
    from .api.routes import _unified_client
    if _unified_client:
        await _unified_client.close()


app = FastAPI(
    title="MoleCraft Generative Diffusion",
    description="Pocket-conditioned 3D molecular diffusion with multi-objective optimization",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    from .api.routes import _model_loaded, _device
    return {
        "status": "ok" if _model_loaded else "loading",
        "model_loaded": _model_loaded,
        "device": _device,
        "service": "generative_diffusion"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)