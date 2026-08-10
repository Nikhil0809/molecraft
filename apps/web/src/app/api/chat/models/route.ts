import { NextResponse } from "next/server";

const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "Groq (Cloud)", best: true },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "Groq (Cloud)" },
  { id: "qwen/qwen3-32b", name: "Qwen3 32B", provider: "Groq (Cloud)" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", provider: "Groq (Cloud)" },
];

export async function GET() {
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);

  if (groqConfigured) {
    return NextResponse.json({ models: GROQ_MODELS, groq_configured: true });
  }

  return NextResponse.json({ models: GROQ_MODELS, groq_configured: false });
}