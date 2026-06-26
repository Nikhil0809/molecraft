import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "all";
    const q = searchParams.get("q") || "";

    let query = sql`SELECT * FROM projects WHERE user_id = ${user.id}`;

    if (tab === "favorites") {
      query = sql`${query} AND favorite = true`;
    }

    if (q) {
      query = sql`${query} AND (name ILIKE ${`%${q}%`} OR description ILIKE ${`%${q}%`})`;
    }

    query = sql`${query} ORDER BY updated_at DESC`;

    const projects = await query;
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, color } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await sql`
      INSERT INTO projects (id, user_id, name, description, color)
      VALUES (${id}, ${user.id}, ${name}, ${description || ""}, ${color || "#7C3AED"})
    `;

    return NextResponse.json({ project: { id, name, description: description || "", color: color || "#7C3AED", status: "active", favorite: false, molecule_count: 0 } });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, favorite } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    await sql`
      UPDATE projects SET favorite = ${favorite}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/projects error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
