import { NextRequest, NextResponse } from "next/server";

const API = process.env.PEPTIDE_API_URL || "http://localhost:8023";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.action === "macrocycle" ? `${API}/macrocycle/design` : `${API}/design`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Peptide API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
