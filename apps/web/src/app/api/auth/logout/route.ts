import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("molecraft_session");

    if (sessionCookie && sessionCookie.value) {
      await deleteSession(sessionCookie.value);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("molecraft_session");
    
    return response;
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
