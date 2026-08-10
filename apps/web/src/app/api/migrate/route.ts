import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // Add onboarding columns to users table
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS professional_role VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS usage_intent VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS referral_source VARCHAR(50) DEFAULT NULL
    `;

    // Projects table
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'active',
        color VARCHAR(10) DEFAULT '#7C3AED',
        favorite BOOLEAN DEFAULT false,
        molecule_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Notifications table
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Team members table
    await sql`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invited_by UUID REFERENCES users(id),
        email VARCHAR(255) NOT NULL,
        role VARCHAR(30) DEFAULT 'editor',
        status VARCHAR(20) DEFAULT 'pending',
        invited_at TIMESTAMP DEFAULT NOW(),
        joined_at TIMESTAMP
      )
    `;

    // Invoices table
    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan VARCHAR(50) NOT NULL,
        amount INTEGER NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        status VARCHAR(20) DEFAULT 'paid',
        period_start TIMESTAMP,
        period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Api keys table
    await sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Conversations table
    await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT 'New chat',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Chat messages table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id)`;

    // Docking runs table
    await sql`
      CREATE TABLE IF NOT EXISTS docking_runs (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
        molecule_id UUID REFERENCES molecules(id) ON DELETE SET NULL,
        smiles TEXT NOT NULL,
        target_protein VARCHAR(255) NOT NULL,
        engine VARCHAR(20) DEFAULT 'vina',
        best_affinity_kcal_mol DOUBLE PRECISION,
        num_poses INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Docking poses table
    await sql`
      CREATE TABLE IF NOT EXISTS docking_poses (
        id UUID PRIMARY KEY,
        run_id UUID NOT NULL REFERENCES docking_runs(id) ON DELETE CASCADE,
        pose_id INTEGER NOT NULL,
        affinity_kcal_mol DOUBLE PRECISION NOT NULL,
        rmsd_lb DOUBLE PRECISION,
        rmsd_ub DOUBLE PRECISION,
        confidence DOUBLE PRECISION,
        coordinates JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_docking_runs_user_id ON docking_runs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_docking_poses_run_id ON docking_poses(run_id)`;

    return NextResponse.json({ success: true, message: "Migration completed successfully" });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ success: false, error: "Migration failed" }, { status: 500 });
  }
}
