import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [totalMolecules, avgAffinity, totalPredictions] = await Promise.all([
      sql`SELECT COUNT(*) as c FROM molecules WHERE user_id = ${user.id}`,
      sql`SELECT AVG(affinity) as a FROM predictions WHERE user_id = ${user.id}`,
      sql`SELECT COUNT(*) as c FROM predictions WHERE user_id = ${user.id}`,
    ]);

    const dailyActivity = await sql`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM molecules WHERE user_id = ${user.id}
      GROUP BY DATE(created_at)
      ORDER BY day DESC LIMIT 30
    `;

    const recentMolecules = await sql`
      SELECT target as name, smiles, molecular_formula as formula,
             user_id, created_at as date, status
      FROM molecules WHERE user_id = ${user.id}
      ORDER BY created_at DESC LIMIT 10
    `;

    return NextResponse.json({
      metrics: {
        total_molecules: parseInt(totalMolecules[0].c) || 0,
        avg_affinity: avgAffinity[0].a ? parseFloat(avgAffinity[0].a).toFixed(1) : "0",
        total_predictions: parseInt(totalPredictions[0].c) || 0,
      },
      daily_activity: dailyActivity.map((d: Record<string, any>) => ({
        day: String(d.day || ""),
        count: parseInt(String(d.count)) || 0,
      })),
      recent_molecules: recentMolecules.map((m: Record<string, any>) => ({
        name: m.name || "",
        smiles: m.smiles || "",
        formula: m.formula || "",
        date: String(m.date || ""),
        status: m.status || "",
      })),
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
