import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const cookieStore = await req.cookies;
    const sessionCookie = cookieStore.get("molecraft_session");
    
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verified = await verifySession(sessionCookie.value);
    if (!verified) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = verified.user.id;

    // 2. Fetch generations
    const generations = await sql`
      SELECT 
        id, 
        query, 
        'generate' as mode, 
        created_at as timestamp, 
        molecule_count as "moleculeCount", 
        top_affinity_nm as "topAffinity" 
      FROM molecule_generations 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // 3. Fetch predictions
    const predictions = await sql`
      SELECT 
        id, 
        smiles as query, 
        'predict' as mode, 
        created_at as timestamp, 
        1 as "moleculeCount", 
        affinity_nm as "topAffinity",
        target_protein as "targetProtein"
      FROM predictions 
      WHERE user_id = ${userId} AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // 4. Combine and sort
    const combined = [...generations, ...predictions]
      .map(item => ({
        id: item.id,
        query: item.query,
        mode: item.mode,
        timestamp: new Date(item.timestamp).toISOString(),
        moleculeCount: Number(item.moleculeCount),
        topAffinity: item.topAffinity ? Number(item.topAffinity) : null,
        targetProtein: item.targetProtein || undefined
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ history: combined });

  } catch (error) {
    console.error("GET /api/history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
