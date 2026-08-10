# MoleCraft

**AI-Powered Drug Discovery Platform** — A comprehensive, open-source (MIT) platform integrating generative chemistry, multi-omics target verification, predictive toxicology, molecular docking, and real-time laboratory workflows.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MoleCraft Platform                       │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 16 + React 19)                              │
│  ├── Landing Page with Interactive Canvas                      │
│  ├── 25+ Feature Pages (Generate, Workspace, Lab, Clinical)   │
│  ├── Authentication (JWT + Neon PostgreSQL)                   │
│  └── Modern UI Components (Button, Card, Modal, Toast, etc.)  │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway (FastAPI) — Single Entry Point                    │
│  └── Dynamically mounts 18+ microservices                     │
├─────────────────────────────────────────────────────────────────┤
│  Microservices (FastAPI + Pydantic)                            │
│  ├── foundation_models     - GNN, ESM, ESMFold, MolT5         │
│  ├── rna_design            - siRNA, ASO, mRNA design          │
│  ├── docking               - AutoDock Vina, DiffDock, GNINA   │
│  ├── peptide_design        - Peptides & macrocycles           │
│  ├── rag_pipeline          - Multi-source RAG + Groq LLM      │
│  ├── affinity_predictor    - Binding affinity ML              │
│  ├── admet_ml              - ADMET property prediction        │
│  ├── generative            - Molecule generation              │
│  ├── generative_diffusion  - Diffusion-based generation       │
│  ├── antibody_design       - Antibody engineering             │
│  ├── protac_design         - PROTAC design                    │
│  ├── proteochem            - Proteochemometrics               │
│  ├── omics_discovery       - Multi-omics analysis             │
│  ├── clinical_trial        - Clinical trial prediction        │
│  ├── lab_automation        - Lab workflow automation          │
│  ├── physics_sim           - Molecular dynamics               │
│  ├── patent_ip             - Patent analysis                  │
│  ├── molecule_qa           - Molecule Q&A                     │
│  └── ingestion_service     - Document ingestion & ChromaDB    │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- NVIDIA GPU (optional, for GPU-accelerated services)
- Node.js 20+ (for frontend development)
- Python 3.11+ (for backend development)

### Production Deployment

```bash
# Clone repository
git clone https://github.com/your-org/molecraft.git
cd molecraft

# Configure environment
cp .env.example .env
# Edit .env with your API keys and database URL

# Deploy with Docker Compose
docker-compose up -d

# Access web interface
open http://localhost:3000

# API Gateway available at
open http://localhost:8000/health
```

### Development Setup

#### Frontend
```bash
cd apps/web
npm install
npm run dev
# Available at http://localhost:3000
```

#### Backend Services
```bash
# Install Python dependencies
pip install -r models/requirements.txt

# Run individual service
cd models/foundation_models
python -m uvicorn main:app --reload --port 8005

# Or run all via gateway
cd models
python gateway.py
# Gateway at http://localhost:8000
```

#### Run Tests
```bash
# Python tests
pytest tests/ -v --cov=models

# Frontend tests
cd apps/web
npm test
npm run test:coverage
```

## Environment Variables

Create `.env` in project root:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db
SESSION_SECRET=your-secure-random-string

# External APIs
PUBMED_API_KEY=your-pubmed-key
TAVILY_API_KEY=your-tavily-key
GROQ_API_KEY=your-groq-key
OPENAI_API_KEY=your-openai-key

# ChromaDB (Vector Store)
CHROMA_HOST=api.trychroma.com
CHROMA_TENANT=your-tenant
CHROMA_DATABASE=molecraft
CHROMA_COLLECTION=molecraft
CHROMA_API_KEY=your-chroma-key

# Docking
VINA_PATH=vina

# Embedding Provider
EMBEDDING_PROVIDER=local  # or openai
```

## API Reference

### Gateway Health
```
GET /health
```

### Foundation Models
```
POST /foundation_models/gnn/predict
POST /foundation_models/esm/embed
POST /foundation_models/fold
POST /foundation_models/molt5
```

### RNA Design
```
POST /rna_design/sirna/design
POST /rna_design/aso/design
POST /rna_design/mrna/optimize
```

### Docking
```
POST /docking/dock
GET  /docking/health
```

### Peptide Design
```
POST /peptide_design/design
POST /peptide_design/macrocycle/design
```

### RAG Pipeline
```
POST /rag_pipeline/search
POST /rag_pipeline/reason
POST /rag_pipeline/query
POST /rag_pipeline/semantic-search
```

### Full API Documentation
Available at `/docs` on each service (Swagger UI).

## Key Features

### 1. Generative Chemistry
- **Diffusion Models**: 3D-aware molecule generation
- **Reinforcement Learning**: Goal-directed optimization
- **Fragment-based**: Scaffold hopping & elaboration

### 2. Structure-Based Design
- **AutoDock Vina**: Fast molecular docking
- **DiffDock**: Deep learning pose prediction (planned)
- **GNINA**: CNN-based scoring (planned)
- **Binding Site Detection**: Automated pocket finding

### 3. RNA Therapeutics
- **siRNA**: Seed region optimization, off-target minimization
- **ASO**: Gapmer design, RNase H activity prediction
- **mRNA**: Codon optimization, UTR design, stability

### 4. Peptide & Macrocycle Engineering
- **Linear Peptides**: Helical content, amphipathicity, permeability
- **Macrocycles**: Stapling, disulfide, lactam, triazole, thioether
- **Oral Bioavailability**: Rule-of-5 compliant design

### 5. Multi-Source RAG Pipeline
- **Tier 1**: ChEMBL, PubMed, PubChem, UniProt
- **Tier 2**: Patents, ClinicalTrials.gov
- **Tier 3**: Tavily, Wikipedia, Web Search
- **LLM Reasoning**: Groq (Mixtral, Llama3) integration

### 6. Predictive Toxicology (ADMET)
- Absorption, Distribution, Metabolism, Excretion, Toxicity
- hERG, CYP inhibition, Ames mutagenicity
- BBB permeability, plasma protein binding

### 7. Laboratory Automation
- Protocol generation (Opentrons, Tecan)
- Sample tracking & inventory
- Real-time instrument integration

## Project Structure

```
molecraft/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/         # App Router pages & API routes
│   │   │   ├── components/  # React components
│   │   │   ├── lib/         # Utilities (auth, db, hooks)
│   │   │   └── hooks/       # Custom React hooks
│   │   └── package.json
│   └── rag-admin/           # Admin dashboard (planned)
├── models/                  # Python microservices
│   ├── gateway.py           # API Gateway
│   ├── run.py               # Unified runner
│   ├── requirements.txt     # Aggregated dependencies
│   ├── foundation_models/   # GNN, ESM, Folding, MolT5
│   ├── rna_design/          # siRNA, ASO, mRNA
│   ├── docking/             # Vina, DiffDock, GNINA
│   ├── peptide_design/      # Peptides, macrocycles
│   ├── rag_pipeline/        # Multi-source RAG
│   ├── affinity_predictor/  # Binding affinity ML
│   ├── admet_ml/            # ADMET prediction
│   ├── generative/          # Molecule generation
│   ├── generative_diffusion/# Diffusion models
│   ├── antibody_design/     # Antibody engineering
│   ├── protac_design/       # PROTAC design
│   ├── proteochem/          # Proteochemometrics
│   ├── omics_discovery/     # Multi-omics
│   ├── clinical_trial/      # Trial prediction
│   ├── lab_automation/      # Lab workflows
│   ├── physics_sim/         # MD simulation
│   ├── patent_ip/           # Patent analysis
│   ├── molecule_qa/         # Q&A system
│   └── ingestion_service/   # Document ingestion
├── tests/                   # Python test suite
├── docker-compose.yml       # Full stack orchestration
├── Dockerfile.web           # Frontend container
├── Dockerfile.models        # Backend container
├── .env                     # Environment config
└── README.md
```

## Testing

### Python Tests
```bash
# All tests
pytest tests/ -v

# Specific service
pytest tests/test_foundation_models.py -v
pytest tests/test_rna_design.py -v
pytest tests/test_docking.py -v
pytest tests/test_peptide_design.py -v
pytest tests/test_gateway.py -v
pytest tests/test_rag_pipeline.py -v

# With coverage
pytest tests/ --cov=models --cov-report=html
```

### Frontend Tests
```bash
cd apps/web
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| web | 3000 | Next.js frontend |
| gateway | 8000 | API Gateway |
| foundation_models | 8005 | GNN, ESM, Folding |
| rna_design | 8022 | RNA therapeutics |
| docking | 8003 | Molecular docking |
| peptide_design | 8023 | Peptide design |
| rag_pipeline | 8002 | RAG + LLM |
| affinity_predictor | 8001 | Binding affinity |
| admet_ml | 8006 | ADMET prediction |
| generative | 8000 | Molecule generation |
| generative_diffusion | 8000 | Diffusion models |
| antibody_design | 8020 | Antibody engineering |
| protac_design | 8021 | PROTAC design |
| proteochem | 8004 | Proteochemometrics |
| omics_discovery | 8010 | Multi-omics |
| clinical_trial | 8030 | Trial prediction |
| lab_automation | 8040 | Lab workflows |
| physics_sim | 8050 | MD simulation |
| patent_ip | 8060 | Patent analysis |
| molecule_qa | 8007 | Molecule Q&A |
| ingestion_service | 8011 | Document ingestion |

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `pytest tests/` and `npm test`
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push branch: `git push origin feature/amazing-feature`
6. Open Pull Request

### Code Style
- **Python**: Black, Ruff, MyPy
- **TypeScript**: ESLint, Prettier
- **Commits**: Conventional Commits

## License

MIT License — See [LICENSE](LICENSE) for details.

## Citation

```bibtex
@software{molecraft2026,
  title = {MoleCraft: AI-Powered Drug Discovery Platform},
  author = {MoleCraft Contributors},
  year = {2026},
  url = {https://github.com/your-org/molecraft}
}
```

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/molecraft/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/molecraft/discussions)
- **Email**: support@molecraft.ai

## Roadmap

- [ ] DiffDock integration for differentiable docking
- [ ] GNINA CNN scoring function
- [ ] ESMFold/AlphaFold2 structure prediction
- [ ] Federated learning across institutions
- [ ] Active learning loops for hit optimization
- [ ] Quantum chemistry integration (QM/MM)
- [ ] Clinical trial protocol generation
- [ ] Regulatory submission automation