import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await sql`
      SELECT id, display_name as name, role, email, avatar_url, is_active as status
      FROM users
      WHERE organization = ${user.organization}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ members });
  } catch (error) {
    console.error("GET /api/team error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
