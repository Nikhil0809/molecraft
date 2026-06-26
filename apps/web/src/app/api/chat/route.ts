import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await sql`
    SELECT
      c.id,
      c.title,
      c.created_at,
      c.updated_at,
      (SELECT content FROM chat_messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) AS first_message
    FROM conversations c
    WHERE c.user_id = ${user.id}
    ORDER BY c.updated_at DESC
  `;

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title } = await req.json();

  const [conversation] = await sql`
    INSERT INTO conversations (user_id, title)
    VALUES (${user.id}, ${title || "New chat"})
    RETURNING id, title, created_at, updated_at
  `;

  return NextResponse.json({ conversation }, { status: 201 });
}
