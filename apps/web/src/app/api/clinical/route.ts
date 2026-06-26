import { NextRequest, NextResponse } from "next/server";

const API = process.env.CLINICAL_API_URL || "http://localhost:8030";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "design-trial";
    const endpoints: Record<string, string> = {
      "design-trial": `${API}/design-trial`,
      "simulate-patients": `${API}/simulate-patients`,
      "bayesian-adaptive": `${API}/bayesian-adaptive`,
    };
    const url = endpoints[action] || `${API}/design-trial`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Clinical API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
