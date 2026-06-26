import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("molecraft_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const verified = await verifySession(sessionCookie.value);
    if (!verified) {
      // Clear invalid cookie
      const response = NextResponse.json({ user: null }, { status: 401 });
      response.cookies.delete("molecraft_session");
      return response;
    }

    return NextResponse.json({ user: verified.user });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
