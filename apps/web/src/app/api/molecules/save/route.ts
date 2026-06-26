import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
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

    const { moleculeId, isSaved } = await req.json();

    if (!moleculeId) {
      return NextResponse.json({ error: "Molecule ID is required" }, { status: 400 });
    }

    // 2. Update is_saved in database
    const updateResult = await sql`
      UPDATE molecules
      SET is_saved = ${isSaved}
      WHERE id = ${moleculeId}
      RETURNING id, is_saved
    `;

    if (updateResult.length === 0) {
      return NextResponse.json({ error: "Molecule not found" }, { status: 444 });
    }

    return NextResponse.json({ success: true, molecule: updateResult[0] });

  } catch (error) {
    console.error("POST /api/molecules/save error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
