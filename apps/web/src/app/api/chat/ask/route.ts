import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const RAG_API_URL = process.env.RAG_API_URL || "http://localhost:8002";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const MAX_CONTEXT_TOKENS = 30000;

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

  const tokens = q.split(/\s+/).filter(Boolean);
  const matches = CHEMISTRY_KEYWORDS.filter((kw) => q.includes(kw));
  const score = tokens.length > 0 ? matches.length / tokens.length : 0;

  if (score >= 0.1) return { allowed: true, score, reason: "chemistry_related" };
  return { allowed: score > 0, score, reason: score > 0 ? "vague" : "non_chemistry" };
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3.6));
}

interface RagSource {
  name: string;
  status: string;
  result_count: number;
  tier: number;
}

interface RagCitation {
  id: string;
  source: string;
  title: string;
  year: number;
  url: string;
  tier: number;
}

interface RagResult {
  sources: RagSource[];
  citations: RagCitation[];
}

async function callRag(query: string): Promise<RagResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const resp = await fetch(`${RAG_API_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, depth: "deep", citation_tier: "all" }),
      signal: controller.signal,
    });
    if (resp.ok) return (await resp.json()) as RagResult;
  } catch {}
  finally { clearTimeout(timeout); }
  return null;
}

async function loadHistory(conversationId: string, query: string, regenerate: boolean) {
  let rows: { role: string; content: string }[] = [];
  try {
    rows = (await sql`
      SELECT role, content FROM chat_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC, id ASC
    `) as { role: string; content: string }[];
  } catch {}

  let history = rows.filter((r) => r.role === "user" || r.role === "assistant");

  if (regenerate && history.length > 1) {
    // Drop any assistant reply(ies) after the last user turn so the new
    // answer doesn't duplicate them.
    let k = history.length;
    while (k > 0 && history[k - 1].role === "assistant") k--;
    history = history.slice(0, k);
    try {
      await sql`
        DELETE FROM chat_messages
        WHERE conversation_id = ${conversationId}
          AND role = 'assistant'
          AND created_at > (
            SELECT MAX(created_at) FROM chat_messages
            WHERE conversation_id = ${conversationId} AND role = 'user'
          )
      `;
    } catch {}
  }

  // The last history turn is usually the user message we just saved — drop
  // it since the standalone `query` body is the current question.
  const last = history[history.length - 1];
  if (last && last.role === "user" && last.content === query) {
    history = history.slice(0, -1);
  }

  // Context window management: keep the newest turns within the token budget.
  const budgeted: { role: string; content: string }[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    const cost = estimateTokens(turn.content);
    if (used + cost > MAX_CONTEXT_TOKENS && budgeted.length > 0) break;
    used += cost;
    budgeted.unshift({ role: turn.role, content: turn.content });
  }

  return { history: budgeted, historyTokens: used };
}

/**
 * Direct Groq streaming fallback (no RAG pipeline needed). Produces the same
 * SSE event shape as the RAG stream: { token }, { done }, { error }.
 */
function streamGroqDirect(
  query: string,
  history: { role: string; content: string }[],
  model: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const system = [
        "You are MoleCraft AI, a precise scientific assistant specialized in molecular design, ",
        "drug discovery, and computational chemistry. Answer concisely and accurately. ",
        "If the question needs research you don't have, say so and provide your best scientific knowledge. ",
        "Use markdown with LaTeX ($...$ / $$...$$) and code blocks where helpful.",
      ].join("");

      const messages = [
        { role: "system", content: system },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: query },
      ];

      try {
        const resp = await fetch(GROQ_CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0,
            max_tokens: 4096,
            stream: true,
          }),
          signal: AbortSignal.timeout(120000),
        });

        if (!resp.ok || !resp.body) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: `Groq request failed (${resp.status})` })}\n\n`
            )
          );
          controller.close();
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload);
              const delta = chunk?.choices?.[0]?.delta;
              if (delta && typeof delta.content === "string" && delta.content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token: delta.content })}\n\n`)
                );
              }
            } catch {}
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (e) {
        console.error("Groq direct stream error:", e);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)
        );
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, model: selectedModel, stream, conversationId, regenerate } = await req.json();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

  const model = selectedModel || GROQ_MODEL;
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

  const { history, historyTokens } = conversationId
    ? await loadHistory(conversationId, query, !!regenerate)
    : { history: [], historyTokens: 0 };

  // Non-streaming (back-compatible) path — still Groq only.
  if (!stream) {
    let answer = await callGroqPipeline(query, history, model);
    let ragResult: RagResult | null = null;

    if (!answer) {
      ragResult = await callRag(query);
      const citations = (ragResult?.citations ?? []).slice(0, 8).map((c) => ({
        source: c.source, title: c.title, year: c.year,
      }));
      const hasResults = (ragResult?.sources ?? []).some((s) => s.status === "done" && s.result_count > 0);
      answer = hasResults
        ? `Based on my search, here's what I found:\n\n### Research Context\n${citations.map((c) => `- [${c.source}] ${c.title} (${c.year})`).join("\n") || "No specific citations."}\n\nFor deeper analysis, try asking about specific targets, compounds, or mechanisms.`
        : `I searched across molecular databases and the web but couldn't find specific results for "${query}". Try rephrasing or providing more details (e.g., target protein, SMILES, or disease).`;
    }

    return NextResponse.json({
      answer,
      model,
      chemistry_score: filter.score,
      chemistry_reason: filter.reason,
      sources: (ragResult?.sources ?? []).map((s) => ({
        name: s.name, status: s.status, resultCount: s.result_count, tier: s.tier,
      })),
      citations: (ragResult?.citations ?? []).slice(0, 8).map((c) => ({
        source: c.source, title: c.title, year: c.year, url: c.url,
      })),
    });
  }

  // ── Streaming (SSE) — Groq via RAG pipeline, direct Groq as fallback ──
  const encoder = new TextEncoder();

  const sseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        // Collect RAG sources/citations in parallel with the stream setup.
        const ragState: { result: RagResult | null } = { result: null };
        const ragPromise = callRag(query).then((r) => (ragState.result = r));

        // Prefer the RAG pipeline's Groq stream (includes context chunks).
        let upstream: ReadableStream<Uint8Array> | null = null;

        const ragFetchPromise = fetch(`${RAG_API_URL}/query/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, n_results: 10, model, history }),
          signal: AbortSignal.timeout(30000),
        })
          .then((resp) => {
            if (resp.ok && resp.body) {
              upstream = resp.body;
            }
            return upstream;
          })
          .catch(() => null);

        await Promise.allSettled([ragPromise, ragFetchPromise]);

        const ragSources = (ragState.result?.sources ?? []).map((s) => ({
          name: s.name, status: s.status, resultCount: s.result_count, tier: s.tier,
        }));
        const citations = (ragState.result?.citations ?? []).slice(0, 10).map((c) => ({
          id: c.id, source: c.source, title: c.title, year: c.year, url: c.url, tier: c.tier,
        }));

        send({
          type: "meta",
          model,
          conversationId: conversationId ?? null,
          chemistry_score: filter.score,
          chemistry_reason: filter.reason,
          sources: ragSources,
          citations,
          usage: { historyTokens },
        });

        if (!upstream) {
          // Groq-only fallback (direct API, no Ollama).
          upstream = streamGroqDirect(query, history, model);
        }

        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Normalize arbitrary chunk boundaries before SSE parsing.
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            const line = event.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const data = JSON.parse(payload);
              if (data.type) {
                // Relay fully-formed events from upstream untouched.
                send(data);
              } else if (typeof data.error === "string") {
                send({ type: "error", error: data.error });
                controller.close();
                return;
              } else if (data.token) {
                send({ type: "token", token: data.token });
              } else if (data.done) {
                send({ type: "done" });
                controller.close();
                return;
              }
            } catch {}
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (e) {
        console.error("SSE stream error:", e);
        send({ type: "error", error: String(e) });
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function callGroqPipeline(
  query: string,
  history: { role: string; content: string }[],
  model: string
): Promise<string | null> {
  try {
    const resp = await fetch(`${RAG_API_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, n_results: 10, model, history }),
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