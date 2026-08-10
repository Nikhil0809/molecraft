import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const cookieStore = await req.cookies;
    const sessionCookie = cookieStore.get("molecraft_session");
    
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verified = await verifySession(sessionCookie.value);
    if (!verified) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = verified.user.id;

    // 2. Fetch settings
    const settingsRows = await sql`
      SELECT * FROM user_settings WHERE user_id = ${userId} LIMIT 1
    `;

    let settings = settingsRows[0];
    if (!settings) {
      // Create defaults if not exists
      const newSettings = await sql`
        INSERT INTO user_settings (
          user_id, rag_depth, citation_tier, min_mol_weight, max_mol_weight,
          show_atom_indices, explicit_methyl, highlight_color, updated_at
        )
        VALUES (
          ${userId}, 'deep', 't1_t2', 150, 550, false, false, '#4F8EF7', NOW()
        )
        RETURNING *
      `;
      settings = newSettings[0];
    }

    return NextResponse.json({
      user: verified.user,
      settings: {
        ragDepth: settings.rag_depth,
        citationTier: settings.citation_tier,
        minMw: settings.min_mol_weight,
        maxMw: settings.max_mol_weight,
        showAtomIndices: settings.show_atom_indices,
        explicitMethyl: settings.explicit_methyl,
        highlightColor: settings.highlight_color,
      }
    });

  } catch (error) {
    console.error("GET /api/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // 1. Authenticate user
    const cookieStore = await req.cookies;
    const sessionCookie = cookieStore.get("molecraft_session");
    
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verified = await verifySession(sessionCookie.value);
    if (!verified) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = verified.user.id;
    const body = await req.json();
    const { ragDepth, citationTier, minMw, maxMw, showAtomIndices, explicitMethyl, highlightColor } = body;

    // Update settings in DB
    await sql`
      INSERT INTO user_settings (
        user_id, rag_depth, citation_tier, min_mol_weight, max_mol_weight,
        show_atom_indices, explicit_methyl, highlight_color, updated_at
      )
      VALUES (
        ${userId},
        ${ragDepth || 'deep'},
        ${citationTier || 't1_t2'},
        ${minMw !== undefined ? minMw : 150},
        ${maxMw !== undefined ? maxMw : 550},
        ${showAtomIndices !== undefined ? showAtomIndices : false},
        ${explicitMethyl !== undefined ? explicitMethyl : false},
        ${highlightColor || '#4F8EF7'},
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET 
        rag_depth = EXCLUDED.rag_depth,
        citation_tier = EXCLUDED.citation_tier,
        min_mol_weight = EXCLUDED.min_mol_weight,
        max_mol_weight = EXCLUDED.max_mol_weight,
        show_atom_indices = EXCLUDED.show_atom_indices,
        explicit_methyl = EXCLUDED.explicit_methyl,
        highlight_color = EXCLUDED.highlight_color,
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("PUT /api/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await req.cookies;
    const sessionCookie = cookieStore.get("molecraft_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verified = await verifySession(sessionCookie.value);
    if (!verified) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = verified.user.id;
    const body = await req.json();
    const { professionalRole, usageIntent, referralSource } = body;

    const allowed = ["academic", "industry", "student", "bioinformatician", "clinician", "other", null];
    const allowedIntents = ["drug-discovery", "target-id", "molecular-modeling", "education", "lit-review", "other", null];
    if (professionalRole !== undefined && !allowed.includes(professionalRole)) {
      return NextResponse.json({ error: "Invalid professional role" }, { status: 400 });
    }
    if (usageIntent !== undefined && !allowedIntents.includes(usageIntent)) {
      return NextResponse.json({ error: "Invalid usage intent" }, { status: 400 });
    }

    await sql`
      UPDATE users
      SET
        professional_role = COALESCE(${professionalRole ?? null}, professional_role),
        usage_intent = COALESCE(${usageIntent ?? null}, usage_intent),
        referral_source = COALESCE(${referralSource ?? null}, referral_source),
        updated_at = NOW()
      WHERE id = ${userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
