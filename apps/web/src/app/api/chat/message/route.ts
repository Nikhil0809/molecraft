import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, messageId, content } = await req.json();

  if (!conversationId || !messageId || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [existing] = await sql`
    SELECT m.id FROM chat_messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = ${messageId}
      AND m.conversation_id = ${conversationId}
      AND c.user_id = ${user.id}
    LIMIT 1
  `;
  if (!existing) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const [message] = await sql`
    UPDATE chat_messages
    SET content = ${content}, created_at = NOW()
    WHERE id = ${messageId}
    RETURNING id, role, content, created_at
  `;

  // Branch: drop everything after the edited message.
  await sql`
    DELETE FROM chat_messages
    WHERE conversation_id = ${conversationId}
      AND created_at > (SELECT created_at FROM chat_messages WHERE id = ${messageId})
  `;

  await sql`
    UPDATE conversations SET updated_at = NOW() WHERE id = ${conversationId}
  `;

  return NextResponse.json({ message });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, role, content } = await req.json();

  if (!conversationId || !role || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [message] = await sql`
    INSERT INTO chat_messages (conversation_id, role, content)
    VALUES (${conversationId}, ${role}, ${content})
    RETURNING id, role, content, created_at
  `;

  await sql`
    UPDATE conversations SET updated_at = NOW() WHERE id = ${conversationId}
  `;

  if (role === "user") {
    const count = await sql`
      SELECT COUNT(*) as cnt FROM chat_messages WHERE conversation_id = ${conversationId}
    `;
    if (parseInt(count[0].cnt) === 1) {
      const title = content.length > 60 ? content.slice(0, 60) + "..." : content;
      await sql`
        UPDATE conversations SET title = ${title} WHERE id = ${conversationId}
      `;
    }
  }

  return NextResponse.json({ message }, { status: 201 });
}
