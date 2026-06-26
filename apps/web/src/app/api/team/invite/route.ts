import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, role } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await sql`
      INSERT INTO team_members (id, user_id, invited_by, email, role, status)
      VALUES (${id}, ${user.id}, ${user.id}, ${email}, ${role || "editor"}, 'pending')
    `;

    return NextResponse.json({ success: true, message: "Invitation sent" });
  } catch (error) {
    console.error("POST /api/team/invite error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
