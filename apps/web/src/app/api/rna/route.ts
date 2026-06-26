import { NextRequest, NextResponse } from "next/server";

const API = process.env.RNA_API_URL || "http://localhost:8022";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.action === "aso" ? `${API}/aso/design` :
                body.action === "mrna" ? `${API}/mrna/optimize` :
                `${API}/sirna/design`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`RNA API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
