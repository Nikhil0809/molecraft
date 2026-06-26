import { NextRequest, NextResponse } from "next/server";

const API = process.env.PHYSICS_API_URL || "http://localhost:8050";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "fep";
    const endpoints: Record<string, string> = {
      fep: `${API}/fep`,
      md: `${API}/md`,
      "conformer-search": `${API}/conformer-search`,
      "water-map": `${API}/water-map`,
    };
    const url = endpoints[action] || `${API}/fep`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Physics API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
