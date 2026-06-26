import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

const FALLBACK_MODELS = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", best: true },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic" },
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

let cachedModels: { id: string; name: string; provider: string; best?: boolean }[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  if (cachedModels && Date.now() - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json({ models: cachedModels });
  }

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      const data = await resp.json();
      const models = (data.data || [])
        .filter((m: any) => {
          const id = m.id as string;
          return !id.includes(":free") && !id.includes(":beta") && !id.match(/n?:nightly/);
        })
        .map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          provider: m?.pricing?.provider || "Unknown",
          best: m.id === "openai/gpt-4o-mini" ? true : undefined,
        }));

      if (models.length > 0) {
        cachedModels = models;
        cacheTimestamp = Date.now();
        return NextResponse.json({ models });
      }
    }
  } catch { /* fall through */ }

  cachedModels = FALLBACK_MODELS;
  cacheTimestamp = Date.now();
  return NextResponse.json({ models: FALLBACK_MODELS });
}
