import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const RAG_API_URL = process.env.RAG_API_URL || "http://localhost:8002";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "tinyllama:latest";

const CHEMISTRY_KEYWORDS = [
  "smiles", "inchi", "docking", "molecular dynamics", "md simulation",
  "ic50", "ec50", "ki", "kd", "admet", "adme", "toxicity", "cyp", "herg",
  "protac", "molecular glue", "antibody", "nanobody", "peptide", "rna", "sirna",
  "kinase", "protease", "receptor", "inhibitor", "agonist", "antagonist",
  "clinical trial", "phase 1", "phase 2", "phase 3", "fda", "patent",
  "drug likeness", "lipinski", "pharmacophore", "scaffold", "affinity",
  "potency", "selectivity", "bioavailability", "solubility", "synthesis",
  "retrosynthesis", "protein", "ligand", "molecule", "compound", "chemical",
  "drug", "cancer", "tumor", "therapy", "cell", "assay", "gene", "enzyme",
  "mutation", "variant", "genome", "proteome", "metabolite", "biomarker",
  "alphafold", "esm", "gnn", "qsar", "formulation", "delivery", "nanoparticle",
  "biochemistry", "pharmacology", "medicinal chem", "smiles", "protac",
  "cdk4", "egfr", "her2", "braf", "kras", "p53", "mdm2",
];

const HARD_REJECT = [
  "recipe", "restaurant", "movie", "song", "sports", "game", "travel",
  "vacation", "politics", "news", "weather", "stock", "crypto", "bitcoin",
  "celebrity", "fashion", "music", "book", "poem", "art",
  "car", "bike", "engine", "insurance", "loan", "bank",
];

function isChemistryQuery(query: string): { allowed: boolean; score: number; reason: string } {
  const q = query.toLowerCase().trim();
  if (!q) return { allowed: false, score: 0, reason: "empty" };

  for (const kw of HARD_REJECT) {
    if (q.includes(kw)) return { allowed: false, score: 0, reason: "non_chemistry" };
  }

  const tokens = q.split(/\s+/);
  const matches = CHEMISTRY_KEYWORDS.filter((kw) => q.includes(kw));
  const score = matches.length / Math.max(tokens.length, 1);

  if (score >= 0.1) return { allowed: true, score, reason: "chemistry_related" };
  return { allowed: score > 0, score, reason: score > 0 ? "vague" : "non_chemistry" };
}

async function callRag(query: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const resp = await fetch(`${RAG_API_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, depth: "deep", citation_tier: "all" }),
      signal: controller.signal,
    });
    if (resp.ok) return await resp.json();
  } catch {}
  finally { clearTimeout(timeout); }
  return null;
}

async function callGroqPipeline(query: string): Promise<string | null> {
  try {
    const resp = await fetch(`${RAG_API_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, n_results: 10 }),
      signal: AbortSignal.timeout(60000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.answer || null;
    }
    const body = await resp.text();
    if (resp.status === 503) return null;
    console.error("Groq pipeline error:", resp.status, body);
  } catch (e) {
    console.error("Groq pipeline error:", e);
  }
  return null;
}

function buildPrompt(query: string, ragResult: any): string {
  const sources = ragResult?.sources ?? [];
  const citations = ragResult?.citations ?? [];
  const hasResults = sources.some((s: any) => s.status === "done" && s.result_count > 0);

  if (!hasResults) return query;

  const top = citations.slice(0, 5).map((c: any) => `[${c.source}] ${c.title.slice(0, 120)}`).join("\n");
  return `Context:\n${top}\n\nQ: ${query}\nA:`;
}

async function callOllama(prompt: string, model: string): Promise<string> {
  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        system: "Answer short. No thinking.",
        stream: false,
        options: { temperature: 0, num_predict: 256, keep_alive: "10m" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.response || "";
    }
  } catch (e) {
    console.error("Ollama error:", e);
  }
  return "";
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, model: selectedModel } = await req.json();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

  const model = selectedModel || OLLAMA_MODEL;
  const filter = isChemistryQuery(query);

  if (!filter.allowed) {
    return NextResponse.json({
      answer: "I specialize in chemistry, molecular design, and drug discovery topics. Your question doesn't appear to be related to these areas. Please ask about molecules, drugs, targets, proteins, or related scientific topics.",
      model,
      chemistry_score: filter.score,
      chemistry_reason: filter.reason,
      sources: [],
      citations: [],
    });
  }

  let answer = await callGroqPipeline(query);
  let sources: any[] = [];
  let citations: any[] = [];

  if (!answer) {
    const ragResult = await callRag(query);
    const prompt = buildPrompt(query, ragResult);
    answer = await callOllama(prompt, model);

    sources = (ragResult?.sources ?? []).map((s: any) => ({
      name: s.name, status: s.status, resultCount: s.result_count, tier: s.tier,
    }));
    citations = (ragResult?.citations ?? []).slice(0, 8).map((c: any) => ({
      source: c.source, title: c.title, year: c.year,
    }));

    if (!answer) {
      const hasResults = sources.some((s: any) => s.status === "done" && s.resultCount > 0);
      if (!hasResults) {
        answer = `I searched across molecular databases and the web but couldn't find specific results for "${query}". Try rephrasing or providing more details (e.g., target protein, SMILES, or disease).`;
      } else {
        const citationLines = citations.map((c: any) => `- [${c.source}] ${c.title} (${c.year})`).join("\n");
        answer = `Based on my search, here's what I found:\n\n### Research Context\n${citationLines || "No specific citations."}\n\nFor deeper analysis, try asking about specific targets, compounds, or mechanisms.`;
      }
    }
  }

  return NextResponse.json({
    answer,
    model: answer.includes("mixtral") ? "groq-mixtral" : model,
    chemistry_score: filter.score,
    chemistry_reason: filter.reason,
    sources,
    citations,
  });
}
