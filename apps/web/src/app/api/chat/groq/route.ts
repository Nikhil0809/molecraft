import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const MAX_HISTORY_TURNS = 14;

export async function GET() {
  return NextResponse.json({
    configured: Boolean(GROQ_API_KEY),
    endpoint: GROQ_CHAT_URL,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, conversationId, model } = await req.json();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured on the server" },
      { status: 503 }
    );
  }

  const selectedModel = model || DEFAULT_MODEL;

  let history: { role: string; content: string }[] = [];
  if (conversationId) {
    try {
      const rows = (await sql`
        SELECT role, content FROM chat_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC, id ASC
      `) as { role: string; content: string }[];

      history = rows
        .filter((r) => r.role === "user" || r.role === "assistant")
        .filter((r) => r.content !== query)
        .slice(-MAX_HISTORY_TURNS);
    } catch {}
  }

  const systemPrompt = [
    "You are MoleCraft AI, a precise scientific assistant specialized in molecular design, ",
    "drug discovery, and computational chemistry. Answer concisely and accurately. ",
    "If the question needs research you don't have, say so and provide your best scientific knowledge. ",
    "Use markdown with LaTeX ($...$ / $$...$$) and code blocks where helpful.",
  ].join("");

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: query },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      send({ type: "meta", model: selectedModel, source: "groq" });

      try {
        const resp = await fetch(GROQ_CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages,
            temperature: 0,
            max_tokens: 4096,
            stream: true,
          }),
          signal: AbortSignal.timeout(120000),
        });

        if (!resp.ok || !resp.body) {
          send({ type: "error", error: `Groq request failed (${resp.status})` });
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
                send({ type: "token", token: delta.content });
              }
            } catch {}
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (e) {
        console.error("Groq direct stream error:", e);
        send({ type: "error", error: String(e) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}