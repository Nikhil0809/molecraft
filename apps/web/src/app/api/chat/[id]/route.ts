import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const messages = await sql`
    SELECT id, role, content, created_at
    FROM chat_messages
    WHERE conversation_id = ${id}
    ORDER BY created_at ASC
  `;

  return NextResponse.json({ messages });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [conv] = await sql`
    SELECT id FROM conversations WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
  `;
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await sql`DELETE FROM conversations WHERE id = ${id}`;

  return NextResponse.json({ success: true });
}
