import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "all";
    const q = searchParams.get("q") || "";

    let query = sql`
      SELECT id, name, smiles, molecular_formula as formula,
             molecular_weight as mw, is_saved as favorite, source,
             created_at as date
      FROM molecules WHERE user_id = ${user.id}
    `;

    if (q) {
      query = sql`${query} AND (name ILIKE ${`%${q}%`} OR molecular_formula ILIKE ${`%${q}%`})`;
    }

    if (tab === "favorites") {
      query = sql`${query} AND is_saved = true`;
    }

    query = sql`${query} ORDER BY created_at DESC LIMIT 100`;

    const molecules = await query;
    return NextResponse.json({ molecules });
  } catch (error) {
    console.error("GET /api/library error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
