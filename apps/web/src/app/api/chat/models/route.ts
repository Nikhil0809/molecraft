import { NextResponse } from "next/server";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const FALLBACK_MODELS = [
  { id: "tinyllama:latest", name: "TinyLlama", provider: "Ollama (Local)", best: true },
  { id: "qwen3-fast:latest", name: "Qwen3 Fast", provider: "Ollama (Local)" },
  { id: "qwen3:8b", name: "Qwen3 8B", provider: "Ollama (Local)" },
  { id: "kimi-k2.5:cloud", name: "Kimi K2.5", provider: "Moonshot (Cloud)" },
];

let cachedModels: { id: string; name: string; provider: string; best?: boolean }[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  if (cachedModels && Date.now() - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json({ models: cachedModels });
  }

  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (resp.ok) {
      const data = await resp.json();
      const models = (data.models || [])
        .filter((m: any) => !m.name.includes("embed"))
        .map((m: any) => {
          const name = m.name.replace(":latest", "");
          const isFast = name.includes("fast");
          return {
            id: m.name,
            name: isFast ? `${name.replace("-fast", " Fast")}` : name,
            provider: m.details?.family
              ? `Ollama (${m.details.family})`
              : "Ollama (Local)",
            best: m.name === "tinyllama:latest" ? true : undefined,
          };
        });

      if (models.length > 0) {
        cachedModels = models;
        cacheTimestamp = Date.now();
        return NextResponse.json({ models });
      }
    }
  } catch {}

  cachedModels = FALLBACK_MODELS;
  cacheTimestamp = Date.now();
  return NextResponse.json({ models: FALLBACK_MODELS });
}
