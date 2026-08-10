import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { sql } from "@/lib/db";
import crypto from "crypto";

const DOCKING_API_URL = process.env.DOCKING_API_URL || "http://localhost:8003";

type DockingPoseInput = {
  pose_id: number;
  affinity_kcal_mol: number;
  rmsd_lb: number;
  rmsd_ub: number;
  coordinates: number[][] | null;
  confidence: number | null;
};

type DockingResult = {
  request_id: string;
  smiles: string;
  target: string;
  engine: string;
  num_poses: number;
  poses: DockingPoseInput[];
  status: string;
  binding_site: Record<string, unknown> | null;
};

type DockingError = { error: string };

async function callDockingModel(
  smiles: string,
  targetUniProt: string,
  options: {
    engine?: string;
    center?: { x: number; y: number; z: number };
    size?: { x: number; y: number; z: number };
    exhaustiveness?: number;
    numPoses?: number;
  }
): Promise<DockingResult | DockingError | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const resp = await fetch(`${DOCKING_API_URL}/dock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smiles,
        target_uniprot: targetUniProt,
        engine: options.engine || "vina",
        center_x: options.center?.x ?? 0,
        center_y: options.center?.y ?? 0,
        center_z: options.center?.z ?? 0,
        size_x: options.size?.x ?? 20,
        size_y: options.size?.y ?? 20,
        size_z: options.size?.z ?? 20,
        exhaustiveness: options.exhaustiveness || 8,
        num_poses: options.numPoses || 9,
      }),
      signal: controller.signal,
    });

    if (resp.ok) {
      const data = await resp.json();
      return {
        request_id: data.request_id,
        smiles: data.smiles,
        target: data.target,
        engine: data.engine,
        num_poses: data.num_poses,
        poses: data.poses ?? [],
        status: data.status ?? "completed",
        binding_site: data.binding_site ?? null,
      };
    }

    const errBody = await resp.json().catch(() => ({}));
    return { error: errBody.detail || `Docking service returned status ${resp.status}` };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function bestAffinity(result: DockingResult): number | null {
  const scores = result.poses.map((p) => p.affinity_kcal_mol).filter((v) => Number.isFinite(v));
  return scores.length > 0 ? Math.min(...scores) : null;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await req.cookies;
    const sessionCookie = cookieStore.get("molecraft_session");
    if (!sessionCookie?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const verified = await verifySession(sessionCookie.value);
    if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = verified.user.id;
    const body = await req.json();
    const { smiles, targetProtein } = body;
    if (!smiles || !targetProtein) {
      return NextResponse.json({ error: "SMILES and target protein are required" }, { status: 400 });
    }

    const runId = crypto.randomUUID();
    const cleanSmiles = smiles.trim();

    const result = await callDockingModel(cleanSmiles, targetProtein, {
      engine: body.engine,
      center: body.center,
      size: body.size,
      exhaustiveness: body.exhaustiveness,
      numPoses: body.numPoses,
    });

    if (!result) {
      await insertRun(runId, userId, cleanSmiles, targetProtein, body.engine, "failed", "Docking service unavailable", null);
      return NextResponse.json({ error: "Docking service unavailable. Ensure models are running." }, { status: 503 });
    }

    if ("error" in result) {
      await insertRun(runId, userId, cleanSmiles, targetProtein, body.engine, "failed", result.error, null);
      return NextResponse.json({ id: runId, status: "failed", error: result.error }, { status: 400 });
    }

    const best = bestAffinity(result);
    await insertRun(runId, userId, cleanSmiles, targetProtein, result.engine, "completed", null, best);
    for (const pose of result.poses) {
      await sql`
        INSERT INTO docking_poses (id, run_id, pose_id, affinity_kcal_mol, rmsd_lb, rmsd_ub, confidence, coordinates, created_at)
        VALUES (${crypto.randomUUID()}, ${runId}, ${pose.pose_id}, ${pose.affinity_kcal_mol}, ${pose.rmsd_lb}, ${pose.rmsd_ub}, ${pose.confidence}, ${pose.coordinates ? JSON.stringify(pose.coordinates) : null}, NOW())
      `;
    }

    return NextResponse.json({
      id: runId,
      smiles: cleanSmiles,
      target: targetProtein,
      engine: body.engine || "vina",
      status: "completed",
      bestAffinityKcalMol: best,
      numPoses: result.poses.length,
      bindingSite: result.binding_site,
      poses: result.poses,
      createdAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("POST /api/docking error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function insertRun(
  runId: string,
  userId: string,
  smiles: string,
  targetProtein: string,
  engine: string | undefined,
  status: string,
  errorMessage: string | null,
  bestAffinityKcalMol: number | null
) {
  await sql`
    INSERT INTO docking_runs (id, user_id, smiles, target_protein, engine, best_affinity_kcal_mol, status, error_message, created_at, updated_at)
    VALUES (${runId}, ${userId}, ${smiles}, ${targetProtein}, ${engine || "vina"}, ${bestAffinityKcalMol}, ${status}, ${errorMessage}, NOW(), NOW())
  `;
}