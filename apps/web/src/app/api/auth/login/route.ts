import { NextRequest, NextResponse } from "next/server";
import { comparePassword, createSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Lookup user in DB
    const users = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const user = users[0];

    // Compare passwords
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
    }

    // Extract headers for session
    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress = req.headers.get("x-forwarded-for") || undefined;

    // Create session in DB
    const sessionId = await createSession(user.id, userAgent, ipAddress);

    // Prepare response
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        organization: user.organization,
        avatar_url: user.avatar_url,
        tier: user.tier,
        compute_credits: user.compute_credits,
      }
    });

    // Set secure cookie
    response.cookies.set({
      name: "molecraft_session",
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
