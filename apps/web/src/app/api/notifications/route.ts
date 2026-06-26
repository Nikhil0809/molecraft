import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifications = await sql`
      SELECT * FROM notifications WHERE user_id = ${user.id}
      ORDER BY created_at DESC LIMIT 50
    `;

    const unreadCount = await sql`
      SELECT COUNT(*) as c FROM notifications WHERE user_id = ${user.id} AND is_read = false
    `;

    return NextResponse.json({
      notifications: notifications.map((n: Record<string, any>) => ({
        id: n.id || "",
        type: n.type || "",
        title: n.title || "",
        message: n.message || "",
        read: Boolean(n.is_read),
        time: String(n.created_at || ""),
      })),
      unread_count: parseInt(unreadCount[0].c) || 0,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
