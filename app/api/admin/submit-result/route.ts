import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateTennisScore } from "@/lib/tournament/scoring";

const submitSchema = z.object({
  tournamentId: z.string().uuid(),
  matchId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  sets: z
    .array(
      z.object({
        team1Games: z.number().int().min(0).max(7),
        team2Games: z.number().int().min(0).max(7),
      }),
    )
    .min(2)
    .max(3),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const actor = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });
  }

  const body = submitSchema.parse(await request.json());

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, team1_id, team2_id, round_number, match_number, result_version, status, winner_team_id")
    .eq("id", body.matchId)
    .eq("tournament_id", body.tournamentId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (!match.team1_id || !match.team2_id) {
    return NextResponse.json({ error: "Cannot score match with unresolved participants" }, { status: 422 });
  }

  if (match.result_version !== body.expectedVersion) {
    return NextResponse.json({ error: "Result changed by another administrator. Refresh and retry." }, { status: 409 });
  }

  const validated = validateTennisScore({ sets: body.sets, bestOf: 3 });
  const winnerTeamId = validated.winner === "team1" ? match.team1_id : match.team2_id;

  const { error: updateError } = await supabase
    .from("matches")
    .update({
      status: "completed",
      winner_team_id: winnerTeamId,
      score_summary: validated.summary,
      result_version: match.result_version + 1,
      completed_at: new Date().toISOString(),
    })
    .eq("id", match.id)
    .eq("result_version", body.expectedVersion);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: targetDependencies } = await supabase
    .from("match_dependencies")
    .select("target_match_id, target_slot")
    .eq("source_match_id", match.id);

  for (const dep of targetDependencies ?? []) {
    const key = dep.target_slot === "team1" ? "team1_id" : "team2_id";
    await supabase.from("matches").update({ [key]: winnerTeamId }).eq("id", dep.target_match_id);
  }

  await supabase.from("match_sets").delete().eq("match_id", match.id);
  await supabase.from("match_sets").insert(
    validated.sets.map((set, index) => ({
      match_id: match.id,
      set_number: index + 1,
      team1_games: set.team1Games,
      team2_games: set.team2Games,
    })),
  );

  await supabase.from("audit_events").insert({
    tournament_id: body.tournamentId,
    actor_user_id: actor.userId,
    action: "match.score_submitted",
    entity_type: "match",
    entity_id: match.id,
    reason: body.reason ?? null,
    previous_value: {
      status: match.status,
      winnerTeamId: match.winner_team_id,
    },
    new_value: {
      status: "completed",
      winnerTeamId,
      score: validated.summary,
      sets: validated.sets,
    },
  });

  return NextResponse.json({ ok: true, winnerTeamId, summary: validated.summary });
}
