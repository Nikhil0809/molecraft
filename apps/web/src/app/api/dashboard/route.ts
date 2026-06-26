import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [moleculeCount, predictionCount, projectCount, simulationCount] = await Promise.all([
      sql`SELECT COUNT(*) as c FROM molecules WHERE user_id = ${user.id}`,
      sql`SELECT COUNT(*) as c FROM predictions WHERE user_id = ${user.id}`,
      sql`SELECT COUNT(*) as c FROM projects WHERE user_id = ${user.id} AND status = 'active'`,
      sql`SELECT COUNT(*) as c FROM simulation WHERE user_id = ${user.id}`,
    ]);

    const recentActivity = await sql`
      SELECT 'generation' as type, target, status, created_at as time
      FROM molecules WHERE user_id = ${user.id}
      UNION ALL
      SELECT 'prediction' as type, target, status, created_at as time
      FROM predictions WHERE user_id = ${user.id}
      ORDER BY time DESC LIMIT 10
    `;

    return NextResponse.json({
      stats: {
        molecules_generated: parseInt(moleculeCount[0].c) || 0,
        predictions_run: parseInt(predictionCount[0].c) || 0,
        active_projects: parseInt(projectCount[0].c) || 0,
        simulations_run: parseInt(simulationCount[0].c) || 0,
      },
      recent_activity: recentActivity.map((a: Record<string, any>) => ({
        type: a.type || "",
        target: a.target || "",
        time: String(a.time || ""),
        status: a.status || "",
      })),
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
