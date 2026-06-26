import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { sql } from "./db";
import crypto from "crypto";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const tokenHash = hashToken(sessionId);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await sql`
    INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at, last_seen_at)
    VALUES (${sessionId}, ${userId}, ${tokenHash}, ${ipAddress || null}, ${userAgent || null}, ${expiresAt.toISOString()}, NOW(), NOW())
  `;

  return sessionId;
}

export async function verifySession(sessionId: string): Promise<{ session: { id: string; expires_at: Date }; user: { id: string; email: string; display_name: string; role: string; organization: string; avatar_url: string | null; tier: string; compute_credits: number; professional_role: string | null; usage_intent: string | null; referral_source: string | null } } | null> {
  if (!sessionId) return null;
  
  // Find session and join with user
  const sessions = await sql`
    SELECT s.id as session_id, s.expires_at, u.*
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ${sessionId} AND s.expires_at > NOW()
    LIMIT 1
  `;

  if (sessions.length === 0) return null;
  const sessionUser = sessions[0];

  // Update last seen (non-blocking log update style)
  sql`
    UPDATE sessions
    SET last_seen_at = NOW()
    WHERE id = ${sessionId}
  `.catch(() => {});

  return {
    session: {
      id: sessionUser.session_id,
      expires_at: sessionUser.expires_at,
    },
    user: {
      id: sessionUser.id,
      email: sessionUser.email,
      display_name: sessionUser.display_name,
      role: sessionUser.role,
      organization: sessionUser.organization,
      avatar_url: sessionUser.avatar_url,
      tier: sessionUser.tier,
      compute_credits: sessionUser.compute_credits,
      professional_role: sessionUser.professional_role || null,
      usage_intent: sessionUser.usage_intent || null,
      referral_source: sessionUser.referral_source || null,
    }
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

export async function getCurrentUser(): Promise<{ id: string; email: string; display_name: string; role: string; organization: string; avatar_url: string | null; tier: string; compute_credits: number; professional_role: string | null; usage_intent: string | null; referral_source: string | null } | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("molecraft_session");
    if (!sessionCookie || !sessionCookie.value) {
      return null;
    }
    const verified = await verifySession(sessionCookie.value);
    return verified ? verified.user : null;
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
}
