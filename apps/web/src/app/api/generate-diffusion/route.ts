import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { sql } from "@/lib/db";
import crypto from "crypto";

const GENERATIVE_DIFFUSION_URL = process.env.GENERATIVE_DIFFUSION_API_URL || "http://localhost:8000";

async function callDiffusionService(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const resp = await fetch(`${GENERATIVE_DIFFUSION_URL}/api/v1/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (resp.ok) return await resp.json();
    const errText = await resp.text().catch(() => "");
    console.error("Diffusion service error:", resp.status, errText.slice(0, 500));
  } catch (e) {
    console.error("Diffusion service unreachable:", e);
  } finally {
    clearTimeout(timeout);
  }
  return null;
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

    const payload = {
      pocket: {
        target_uniprot: body.target_uniprot || null,
        target_pdb: body.target_pdb || null,
        pocket_residues: body.pocket_residues || null,
        pocket_radius: body.pocket_radius || 10.0,
      },
      n_samples: body.n_samples || 100,
      n_final: body.n_final || 20,
      affinity_target_nm: body.affinity_target_nm || null,
      admet_constraints: body.admet_constraints || null,
      sa_threshold: body.sa_threshold ?? 4.0,
      qed_threshold: body.qed_threshold ?? 0.4,
      apply_synthesis_filter: body.apply_synthesis_filter ?? true,
      apply_ip_filter: body.apply_ip_filter ?? true,
      ip_similarity_threshold: body.ip_similarity_threshold ?? 0.8,
      guidance_scale: body.guidance_scale ?? 3.0,
      sampling_steps: body.sampling_steps ?? 50,
      sampler_type: body.sampler_type || "ddim",
      seed: body.seed || null,
    };

    const diffResult = await callDiffusionService(payload);
    if (!diffResult) {
      return NextResponse.json(
        { error: "Generative diffusion service unavailable. Ensure models are running with GPU." },
        { status: 503 }
      );
    }

    const generationId = crypto.randomUUID();
    const query = body.query || `Pocket diffusion: ${payload.pocket.target_uniprot || payload.pocket.target_pdb || "unknown target"}`;

    await sql`
      INSERT INTO molecule_generations (id, user_id, conversation_id, query, sources_queried, molecule_count, top_affinity_nm, generation_ms, rag_depth, status, error_message, created_at)
      VALUES (${generationId}, ${userId}, null, ${query}, ${["DiffusionEngine", "SynthesisFilter", "IPFilter"]}, ${diffResult.results.length}, ${null}, ${diffResult.inference_time_ms}, 'diffusion', 'completed', null, NOW())
    `;

    type InsertedMolecule = {
      id: string; smiles: string; name: string; formula: string;
      affinity: number; ciLow: number; ciHigh: number; validationMethod: string;
      molWeight: number; logP: number; hbDonors: number; hbAcceptors: number;
      qed: number; saScore: number; isSaved: boolean;
      ipRisk: string; synthesisRoutes: unknown[]; properties: Record<string, number>;
    };

    const insertedMolecules: InsertedMolecule[] = [];
    for (const m of diffResult.results) {
      const molId = crypto.randomUUID();
      const props = m.properties || {};
      const ipRisk = m.ip_risk || "low";

      try {
        await sql`
          INSERT INTO molecules (id, generation_id, smiles, name, formula, affinity_nm, ci_low, ci_high, validation_method, mol_weight, log_p, hb_donors, hb_acceptors, qed, sa_score, is_saved, created_at)
          VALUES (${molId}, ${generationId}, ${m.smiles}, ${`Diffusion-${diffResult.results.indexOf(m) + 1}`}, ${props.formula || ""}, ${props.affinity || null}, ${null}, ${null}, ${"diffusion_generation"}, ${props.mw || 0}, ${props.logp || 0}, ${props.hbd || 0}, ${props.hba || 0}, ${props.qed || 0}, ${m.sa_score || 0}, false, NOW())
        `;
      } catch (e) {
        console.error("Failed to persist molecule:", e);
      }

      insertedMolecules.push({
        id: molId, smiles: m.smiles,
        name: `Diffusion-${diffResult.results.indexOf(m) + 1}`,
        formula: props.formula || "",
        affinity: props.affinity || 0,
        ciLow: 0, ciHigh: 0,
        validationMethod: "diffusion_generation",
        molWeight: props.mw || 0, logP: props.logp || 0,
        hbDonors: props.hbd || 0, hbAcceptors: props.hba || 0,
        qed: props.qed || 0, saScore: m.sa_score || 0, isSaved: false,
        ipRisk, synthesisRoutes: m.synthesis_routes || [],
        properties: props,
      });
    }

    return NextResponse.json({
      generationId,
      query,
      requestId: diffResult.request_id,
      molecules: insertedMolecules,
      generated: diffResult.generated,
      filtered: diffResult.filtered,
      inferenceTimeMs: diffResult.inference_time_ms,
      sources: [
        { name: "DiffusionEngine", status: "done", resultCount: diffResult.generated, message: `${diffResult.generated} raw molecules sampled` },
        { name: "SynthesisFilter", status: "done", resultCount: diffResult.filtered, message: `Synthesis feasibility checked` },
        { name: "IPFilter", status: "done", resultCount: diffResult.filtered, message: `Patent conflict screening completed` },
      ],
    });
  } catch (error) {
    console.error("POST /api/generate-diffusion error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "generative-diffusion",
    status: "ready",
    version: "1.0.0",
  });
}