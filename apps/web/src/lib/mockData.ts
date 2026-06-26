import type { MoleculeData } from "@/components/molecule/MoleculeCard";
import type { Citation } from "@/components/citation/CitationPanel";
import type { SourceState } from "@/components/retrieval/RetrievalStatusStrip";

export const MOCK_MOLECULES: MoleculeData[] = [
  {
    id: "mol-001",
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    name: "Aspirin",
    affinity: 7.4,
    unit: "nM",
    ciLow: 6.9,
    ciHigh: 7.9,
    validationMethod: "scaffold-split",
    formula: "C₉H₈O₄",
  },
  {
    id: "mol-002",
    smiles: "CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C",
    name: "Testosterone",
    affinity: 12.3,
    unit: "nM",
    ciLow: 10.8,
    ciHigh: 14.1,
    validationMethod: "scaffold-split",
    formula: "C₁₉H₂₈O₂",
  },
  {
    id: "mol-003",
    smiles: "c1ccc2c(c1)cc1ccc3cccc4ccc2c1c34",
    name: "Pyrene",
    affinity: 45.2,
    unit: "nM",
    ciLow: 38.7,
    ciHigh: 52.8,
    validationMethod: "random-split",
    formula: "C₁₆H₁₀",
  },
  {
    id: "mol-004",
    smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    name: "Caffeine",
    affinity: 89.1,
    unit: "nM",
    ciLow: 76.4,
    ciHigh: 103.9,
    validationMethod: "scaffold-split",
    formula: "C₈H₁₀N₄O₂",
  },
  {
    id: "mol-005",
    smiles: "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O",
    name: "Ibuprofen",
    affinity: 5.8,
    unit: "nM",
    ciLow: 4.9,
    ciHigh: 6.8,
    validationMethod: "scaffold-split",
    formula: "C₁₃H₁₈O₂",
  },
  {
    id: "mol-006",
    smiles: "OC(=O)C1=CC=CC=C1O",
    name: "Salicylic Acid",
    affinity: 22.6,
    unit: "nM",
    ciLow: 19.1,
    ciHigh: 26.7,
    validationMethod: "scaffold-split",
    formula: "C₇H₆O₃",
  },
];

export const MOCK_CITATIONS: Citation[] = [
  {
    id: "cit-001",
    source: "PubMed",
    title: "Structural basis of COX-2 inhibition by anti-inflammatory agents",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    tier: 1,
  },
  {
    id: "cit-002",
    source: "ChEMBL",
    title: "Bioactivity data for acetylsalicylic acid against cyclooxygenase targets",
    year: 2024,
    url: "https://www.ebi.ac.uk/chembl/",
    tier: 1,
  },
  {
    id: "cit-003",
    source: "PubMed",
    title: "Machine learning approaches for binding affinity prediction in drug discovery",
    year: 2024,
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    tier: 1,
  },
  {
    id: "cit-004",
    source: "bioRxiv",
    title: "Novel scaffold-hopping strategies for COX-2 selective inhibitor design",
    year: 2024,
    url: "https://www.biorxiv.org/",
    tier: 2,
  },
  {
    id: "cit-005",
    source: "bioRxiv",
    title: "Deep generative models for de novo molecular design with target specificity",
    year: 2025,
    url: "https://www.biorxiv.org/",
    tier: 2,
  },
  {
    id: "cit-006",
    source: "Web",
    title: "COX-2 inhibitor pharmacology — DrugBank reference",
    url: "https://go.drugbank.com/",
    tier: 3,
  },
  {
    id: "cit-007",
    source: "Web",
    title: "Anti-inflammatory drug target overview — Wikipedia",
    url: "https://en.wikipedia.org/",
    tier: 3,
  },
];

export const MOCK_SOURCES_IDLE: SourceState[] = [
  { name: "ChEMBL", status: "idle", tier: 1 },
  { name: "PubMed", status: "idle", tier: 1 },
  { name: "PubChem", status: "idle", tier: 1 },
  { name: "UniProt", status: "idle", tier: 1 },
  { name: "Tavily", status: "idle", tier: 3 },
];

export const MOCK_SOURCES_SEARCHING: SourceState[] = [
  { name: "ChEMBL", status: "done", tier: 1, resultCount: 24, message: "24 bioassay records retrieved" },
  { name: "PubMed", status: "searching", tier: 1, message: "Searching PubMed for COX-2 inhibitor literature..." },
  { name: "PubChem", status: "done", tier: 1, resultCount: 12, message: "12 compound records found" },
  { name: "UniProt", status: "searching", tier: 1, message: "Querying UniProt for target protein data..." },
  { name: "Tavily", status: "idle", tier: 3 },
];

export const MOCK_SOURCES_DONE: SourceState[] = [
  { name: "ChEMBL", status: "done", tier: 1, resultCount: 24, message: "24 bioassay records retrieved" },
  { name: "PubMed", status: "done", tier: 1, resultCount: 18, message: "18 relevant publications found" },
  { name: "PubChem", status: "done", tier: 1, resultCount: 12, message: "12 compound records found" },
  { name: "UniProt", status: "done", tier: 1, resultCount: 3, message: "3 protein entries found" },
  { name: "Tavily", status: "done", tier: 3, resultCount: 5, message: "5 supplementary web results" },
];

export const MOCK_HISTORY = [
  {
    id: "hist-001",
    query: "COX-2 selective inhibitors",
    mode: "generate" as const,
    timestamp: "2025-06-20T14:32:00Z",
    moleculeCount: 6,
    topAffinity: 5.8,
  },
  {
    id: "hist-002",
    query: "CC(=O)Oc1ccccc1C(=O)O",
    mode: "predict" as const,
    timestamp: "2025-06-20T13:15:00Z",
    moleculeCount: 1,
    topAffinity: 7.4,
  },
  {
    id: "hist-003",
    query: "EGFR kinase inhibitors",
    mode: "generate" as const,
    timestamp: "2025-06-19T09:45:00Z",
    moleculeCount: 8,
    topAffinity: 3.2,
  },
  {
    id: "hist-004",
    query: "BRAF V600E mutant binding",
    mode: "generate" as const,
    timestamp: "2025-06-18T16:20:00Z",
    moleculeCount: 4,
    topAffinity: 11.5,
  },
  {
    id: "hist-005",
    query: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    mode: "predict" as const,
    timestamp: "2025-06-18T10:05:00Z",
    moleculeCount: 1,
    topAffinity: 89.1,
  },
];
