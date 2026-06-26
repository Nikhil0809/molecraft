import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const RAG_API_URL = process.env.RAG_API_URL || "http://localhost:8002";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
const SITE_NAME = process.env.SITE_NAME || "MoleCraft";

const AVAILABLE_MODELS = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "google/gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro", provider: "Google" },
  { id: "meta-llama/llama-3.1-8b-instruct", name: "Llama 3.1 8B", provider: "Meta" },
  { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B", provider: "Mistral" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", provider: "DeepSeek" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", provider: "Qwen" },
];

async function callRag(query: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const resp = await fetch(`${RAG_API_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, depth: "normal", citation_tier: "all" }),
      signal: controller.signal,
    });
    if (resp.ok) return await resp.json();
  } catch { /* ignore */ }
  finally { clearTimeout(timeout); }
  return null;
}

function buildPrompt(query: string, ragResult: any): string {
  const sources = ragResult?.sources ?? [];
  const citations = ragResult?.citations ?? [];

  const hasResults = sources.some((s: any) => s.status === "done" && s.result_count > 0);

  if (!hasResults) {
    return `You are MoleCraft AI, a scientific research assistant specializing in molecular design, drug discovery, and computational chemistry.

Answer the following question concisely and accurately. If you don't know something, say so.

User: ${query}

Provide a helpful, focused response with relevant scientific context where applicable.`;
  }

  const citationContext = citations
    .slice(0, 10)
    .map((c: any) => `- [${c.source}] ${c.title} (${c.year})`)
    .join("\n");

  const sourceSummary = sources
    .filter((s: any) => s.status === "done")
    .map((s: any) => `- ${s.name}: ${s.result_count} results`)
    .join("\n");

  return `You are MoleCraft AI, a scientific research assistant specializing in molecular design and drug discovery.

Use the following research context to answer the user's question. Cite sources where relevant.

### Research Context
${citationContext || "No specific citations retrieved."}

### Sources Searched
${sourceSummary || "No sources returned results."}

User: ${query}

Provide a clear, science-grounded answer referencing the context above. Keep it concise.`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, model: selectedModel } = await req.json();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

  const model = selectedModel || "openai/gpt-4o-mini";

  const ragResult = await callRag(query);
  const prompt = buildPrompt(query, ragResult);

  let answer = "";

  if (OPENROUTER_API_KEY) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": SITE_URL,
          "X-Title": SITE_NAME,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a precise scientific assistant. Answer concisely with relevant citations." },
            { role: "user", content: prompt },
          ],
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        answer = data.choices?.[0]?.message?.content || "";
      }
    } catch { /* fall through */ }
  }

  if (!answer) {
    const sources = ragResult?.sources ?? [];
    const citations = ragResult?.citations ?? [];
    const hasResults = sources.some((s: any) => s.status === "done" && s.result_count > 0);

    if (!hasResults) {
      answer = `I searched across multiple molecular databases but couldn't find specific results for "${query}". Try rephrasing or providing more details (e.g., target protein, SMILES, or disease).`;
    } else {
      const citationLines = citations.slice(0, 6).map((c: any) => `- [${c.source}] ${c.title} (${c.year})`).join("\n");
      answer = `Based on my search, here's what I found:\n\n### Research Context\n${citationLines || "No specific citations."}\n\nFor deeper analysis, try asking about specific targets, compounds, or mechanisms.`;
    }
  }

  return NextResponse.json({
    answer,
    model,
    sources: (ragResult?.sources ?? []).map((s: any) => ({ name: s.name, status: s.status, resultCount: s.result_count, tier: s.tier })),
    citations: (ragResult?.citations ?? []).slice(0, 8).map((c: any) => ({ source: c.source, title: c.title, year: c.year })),
  });
}
