import { NextRequest, NextResponse } from "next/server";

const OMICS_API = process.env.OMICS_API_URL || "http://localhost:8010";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${OMICS_API}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Omics API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch(`${OMICS_API}/health`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "unavailable" });
  }
}
