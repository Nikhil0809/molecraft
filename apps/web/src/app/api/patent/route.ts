import { NextRequest, NextResponse } from "next/server";

const API = process.env.PATENT_API_URL || "http://localhost:8060";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "search";
    const endpoints: Record<string, string> = {
      search: `${API}/search`,
      "freedom-to-operate": `${API}/freedom-to-operate`,
      "novelty-check": `${API}/novelty-check`,
      landscape: `${API}/landscape`,
    };
    const url = endpoints[action] || `${API}/search`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Patent API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
