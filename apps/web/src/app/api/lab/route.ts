import { NextRequest, NextResponse } from "next/server";

const API = process.env.LAB_API_URL || "http://localhost:8040";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "retrosynthesis";
    const endpoints: Record<string, string> = {
      retrosynthesis: `${API}/retrosynthesis`,
      "plan-synthesis": `${API}/plan-synthesis`,
      "predict-reaction": `${API}/predict-reaction`,
      order: `${API}/order`,
    };
    const url = endpoints[action] || `${API}/retrosynthesis`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Lab API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
