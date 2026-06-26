import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const logs = await sql`
      SELECT 
        l.id, 
        l.level, 
        l.source, 
        l.message, 
        l.latency_ms as "latencyMs", 
        l.cache_hit as "cacheHit", 
        l.generation_id as "generationId", 
        l.created_at as "timestamp"
      FROM rag_pipeline_logs l
      ORDER BY l.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      logs: logs.map(log => ({
        id: log.id,
        level: log.level,
        source: log.source,
        message: log.message,
        latencyMs: log.latencyMs ? Number(log.latencyMs) : null,
        cacheHit: !!log.cacheHit,
        generationId: log.generationId,
        timestamp: new Date(log.timestamp).toISOString()
      }))
    });
  } catch (error) {
    console.error("GET /api/admin/logs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
