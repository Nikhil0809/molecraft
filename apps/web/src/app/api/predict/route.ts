import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { sql } from "@/lib/db";
import crypto from "crypto";

const MODEL_API_URL = process.env.MODEL_API_URL || "http://localhost:8001";

type AffinityResult = {
  affinity: number;
  ciLow: number;
  ciHigh: number;
  validationMethod: string;
  featureScores: Record<string, number>;
  predictionMs: number;
};

type AffinityError = {
  error: string;
};

async function callAffinityModel(smiles: string, targetProtein: string): Promise<AffinityResult | AffinityError | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(`${MODEL_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smiles, target_protein: targetProtein }),
      signal: controller.signal,
    });

    if (resp.ok) {
      const data = await resp.json();
      return {
        affinity: data.affinity_nm,
        ciLow: data.ci_low,
        ciHigh: data.ci_high,
        validationMethod: data.validation_method,
        featureScores: data.feature_scores,
        predictionMs: data.prediction_ms,
      };
    }

    const errBody = await resp.json().catch(() => ({}));
    return { error: errBody.detail || `Model returned status ${resp.status}` };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
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
    const { targetProtein, smiles, conversationId } = await req.json();

    if (!targetProtein || !smiles) {
      return NextResponse.json({ error: "Target protein and SMILES are required" }, { status: 400 });
    }

    const predictionId = crypto.randomUUID();
    const cleanSmiles = smiles.trim();

    const result = await callAffinityModel(cleanSmiles, targetProtein);

    if (!result) {
      await sql`
        INSERT INTO predictions (
          id, user_id, conversation_id, smiles, target_protein,
          affinity_nm, ci_low, ci_high, validation_method,
          feature_scores, prediction_ms, status, error_message, created_at
        )
        VALUES (
          ${predictionId},
          ${userId},
          ${conversationId || null},
          ${cleanSmiles},
          ${targetProtein},
          null, null, null,
          'rdkit-syntax-validator',
          null,
          50,
          'failed',
          'Model service unavailable',
          NOW()
        )
      `;

      return NextResponse.json({
        id: predictionId,
        status: "failed",
        error: "Affinity prediction service unavailable. Ensure models are running."
      }, { status: 503 });
    }

    if ("error" in result) {
      await sql`
        INSERT INTO predictions (
          id, user_id, conversation_id, smiles, target_protein,
          affinity_nm, ci_low, ci_high, validation_method,
          feature_scores, prediction_ms, status, error_message, created_at
        )
        VALUES (
          ${predictionId},
          ${userId},
          ${conversationId || null},
          ${cleanSmiles},
          ${targetProtein},
          null, null, null,
          'rdkit-syntax-validator',
          null,
          50,
          'failed',
          ${result.error},
          NOW()
        )
      `;

      return NextResponse.json({
        id: predictionId,
        status: "failed",
        error: result.error,
      }, { status: 400 });
    }

    await sql`
      INSERT INTO predictions (
        id, user_id, conversation_id, smiles, target_protein,
        affinity_nm, ci_low, ci_high, validation_method,
        feature_scores, prediction_ms, status, error_message, created_at
      )
      VALUES (
        ${predictionId},
        ${userId},
        ${conversationId || null},
        ${cleanSmiles},
        ${targetProtein},
        ${result.affinity},
        ${result.ciLow},
        ${result.ciHigh},
        ${result.validationMethod},
        ${JSON.stringify(result.featureScores)},
        ${Math.ceil(result.predictionMs)},
        'completed',
        null,
        NOW()
      )
    `;

    return NextResponse.json({
      id: predictionId,
      status: "completed",
      smiles: cleanSmiles,
      targetProtein,
      affinity: result.affinity,
      ciLow: result.ciLow,
      ciHigh: result.ciHigh,
      validationMethod: result.validationMethod,
      featureScores: result.featureScores,
      predictionMs: result.predictionMs,
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("POST /api/predict error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
