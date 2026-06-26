import { NextRequest, NextResponse } from "next/server";
import { hashPassword, createSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, role, organization, professionalRole, usageIntent, referralSource } = await req.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: "Email, password, and name are required" }, { status: 400 });
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
    }

    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);
    const userRole = (role || "researcher").toLowerCase();
    const userOrg = organization || "Independent";

    // Insert user into DB
    await sql`
      INSERT INTO users (
        id, email, display_name, role, organization, password_hash, 
        avatar_url, is_active, tier, compute_credits, created_at, updated_at,
        professional_role, usage_intent, referral_source
      )
      VALUES (
        ${userId}, 
        ${email.toLowerCase().trim()}, 
        ${displayName.trim()}, 
        ${userRole}, 
        ${userOrg}, 
        ${hashedPassword}, 
        null, 
        true, 
        'standard', 
        1000, 
        NOW(), 
        NOW(),
        ${professionalRole || null},
        ${usageIntent || null},
        ${referralSource || null}
      )
    `;

    // Initialize user settings
    await sql`
      INSERT INTO user_settings (
        user_id, rag_depth, citation_tier, min_mol_weight, max_mol_weight,
        show_atom_indices, explicit_methyl, highlight_color, updated_at
      )
      VALUES (
        ${userId},
        'normal',
        'all',
        200,
        600,
        false,
        false,
        '#00d2ff',
        NOW()
      )
    `;

    // Extract headers for session
    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress = req.headers.get("x-forwarded-for") || undefined;

    // Create session in DB
    const sessionId = await createSession(userId, userAgent, ipAddress);

    // Prepare response
    const response = NextResponse.json({
      user: {
        id: userId,
        email: email.toLowerCase().trim(),
        display_name: displayName.trim(),
        role: userRole,
        organization: userOrg,
        avatar_url: null,
        tier: "standard",
        compute_credits: 1000,
        professional_role: professionalRole || null,
        usage_intent: usageIntent || null,
        referral_source: referralSource || null,
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
    console.error("POST /api/auth/signup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
