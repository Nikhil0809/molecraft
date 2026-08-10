import { NextRequest, NextResponse } from "next/server";
import { TARGET_LIBRARY } from "@/lib/targets";

export async function GET(req: NextRequest) {
  try {
    const query = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 12, 50);

    let results = TARGET_LIBRARY;

    if (query) {
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.gene.toLowerCase().includes(query) ||
          t.code.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      targets: results
        .slice(0, limit)
        .map(({ name, gene, code, category }) => ({ name, gene, code, category })),
      total: results.length,
    });
  } catch (error) {
    console.error("GET /api/targets error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}