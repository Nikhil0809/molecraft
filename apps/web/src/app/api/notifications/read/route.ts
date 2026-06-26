import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    await sql`
      UPDATE notifications SET is_read = true
      WHERE id = ${id} AND user_id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/notifications/read error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
