import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

const INGESTION_API_URL = process.env.INGESTION_API_URL || "http://localhost:8011";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 8;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await req.cookies;
    const sessionCookie = cookieStore.get("molecraft_session");
    if (!sessionCookie?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const verified = await verifySession(sessionCookie.value);
    if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (files.length === 0) return NextResponse.json({ error: "No files provided" }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Max ${MAX_FILES} files per upload` }, { status: 400 });

    const attachments: Array<Record<string, unknown>> = [];
    const unparsed: Array<{ name: string; reason: string }> = [];

    for (const file of files) {
      if (file.size === 0) {
        unparsed.push({ name: file.name, reason: "Empty file" });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        unparsed.push({ name: file.name, reason: `Exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB limit` });
        continue;
      }

      const formData = new FormData();
      formData.append("file", file, file.name);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const resp = await fetch(`${INGESTION_API_URL}/parse/file`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          unparsed.push({ name: file.name, reason: (data as { detail?: string }).detail || "Parse failed" });
          continue;
        }
        attachments.push({
          name: file.name,
          size: file.size,
          ...data,
        });
      } catch {
        return NextResponse.json(
          { error: "File parsing service unavailable. Ensure models are running.", attachments, unparsed },
          { status: 503 }
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    return NextResponse.json({ attachments, unparsed });
  } catch (error) {
    console.error("POST /api/chat/upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}