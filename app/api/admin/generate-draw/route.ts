import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateBracketMatches, generateDrawSlots } from "@/lib/tournament/bracket";

type DrawBody = {
  tournamentId?: string;
  cornerTeamIds?: {
    topLeft: string;
    bottomLeft: string;
    topRight: string;
    bottomRight: string;
  };
  forceReset?: boolean;
  reason?: string;
};

export async function POST(request: Request) {
  const actor = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });
  }

  const body = (await request.json()) as DrawBody;
  if (!body.tournamentId || !body.cornerTeamIds) {
    return NextResponse.json({ error: "tournamentId and cornerTeamIds are required" }, { status: 400 });
  }

  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id, status")
    .eq("tournament_id", body.tournamentId);

  if ((existingMatches?.length ?? 0) > 0) {
    const hasCompleted = (existingMatches ?? []).some((match) => match.status === "completed");
    if (hasCompleted && !body.forceReset) {
      return NextResponse.json({ error: "Draw already exists with completed matches. Use forceReset with explicit reason." }, { status: 409 });
    }

    if (!body.forceReset) {
      return NextResponse.json({ error: "Draw already exists. Use forceReset to regenerate." }, { status: 409 });
    }

    const { error: deleteDepsError } = await supabase.from("match_dependencies").delete().eq("tournament_id", body.tournamentId);
    if (deleteDepsError) {
      return NextResponse.json({ error: deleteDepsError.message }, { status: 500 });
    }

    const { error: deleteSetsError } = await supabase
      .from("match_sets")
      .delete()
      .in("match_id", (existingMatches ?? []).map((item) => item.id));

    if (deleteSetsError) {
      return NextResponse.json({ error: deleteSetsError.message }, { status: 500 });
    }

    const { error: deleteMatchesError } = await supabase.from("matches").delete().eq("tournament_id", body.tournamentId);
    if (deleteMatchesError) {
      return NextResponse.json({ error: deleteMatchesError.message }, { status: 500 });
    }
  }

  const { data: teams, error: teamsError } = await supabase.from("teams").select("id").eq("tournament_id", body.tournamentId);
  if (teamsError) {
    return NextResponse.json({ error: teamsError.message }, { status: 500 });
  }

  const draw = generateDrawSlots({
    teams: (teams ?? []).map((team) => team.id),
    cornerTeamIds: body.cornerTeamIds,
  });

  const dependencies = generateBracketMatches(draw.capacity);
  const firstRoundCount = draw.capacity / 2;

  const firstRoundMatches = Array.from({ length: firstRoundCount }, (_, index) => {
    const leftSlot = draw.slots[index * 2];
    const rightSlot = draw.slots[index * 2 + 1];

    const singleBye = !leftSlot.teamId || !rightSlot.teamId;
    const bothMissing = !leftSlot.teamId && !rightSlot.teamId;

    return {
      tournament_id: body.tournamentId,
      round_number: 1,
      match_number: index + 1,
      team1_id: leftSlot.teamId,
      team2_id: rightSlot.teamId,
      winner_team_id: bothMissing ? null : singleBye ? leftSlot.teamId ?? rightSlot.teamId : null,
      status: bothMissing ? "voided" : singleBye ? "completed" : "scheduled",
      score_summary: singleBye ? "BYE" : null,
      source_draw_position_1: leftSlot.position,
      source_draw_position_2: rightSlot.position,
    };
  });

  const laterRoundMatches = dependencies
    .filter((item) => item.roundNumber > 1)
    .map((item) => ({
      tournament_id: body.tournamentId,
      round_number: item.roundNumber,
      match_number: item.matchNumber,
      status: "pending",
    }));

  const { data: createdMatches, error: insertMatchesError } = await supabase
    .from("matches")
    .insert([...firstRoundMatches, ...laterRoundMatches])
    .select("id, round_number, match_number");

  if (insertMatchesError || !createdMatches) {
    return NextResponse.json({ error: insertMatchesError?.message ?? "Failed to create matches" }, { status: 500 });
  }

  const idByRoundAndMatch = new Map(createdMatches.map((match) => [`${match.round_number}-${match.match_number}`, match.id]));

  const dependencyRows = dependencies
    .filter((item) => item.roundNumber > 1 && item.leftSourceMatchNumber && item.rightSourceMatchNumber)
    .flatMap((item) => {
      const targetMatchId = idByRoundAndMatch.get(`${item.roundNumber}-${item.matchNumber}`);
      const leftRound = item.roundNumber - 1;
      const leftMatchNumber = item.matchNumber * 2 - 1;
      const rightMatchNumber = item.matchNumber * 2;
      const leftMatchId = idByRoundAndMatch.get(`${leftRound}-${leftMatchNumber}`);
      const rightMatchId = idByRoundAndMatch.get(`${leftRound}-${rightMatchNumber}`);

      if (!targetMatchId || !leftMatchId || !rightMatchId) {
        return [];
      }

      return [
        {
          tournament_id: body.tournamentId,
          source_match_id: leftMatchId,
          target_match_id: targetMatchId,
          target_slot: "team1",
        },
        {
          tournament_id: body.tournamentId,
          source_match_id: rightMatchId,
          target_match_id: targetMatchId,
          target_slot: "team2",
        },
      ];
    });

  if (dependencyRows.length > 0) {
    const { error: depError } = await supabase.from("match_dependencies").insert(dependencyRows);
    if (depError) {
      return NextResponse.json({ error: depError.message }, { status: 500 });
    }
  }

  await supabase.from("tournaments").update({ bracket_capacity: draw.capacity }).eq("id", body.tournamentId);
  await supabase.from("audit_events").insert({
    tournament_id: body.tournamentId,
    actor_user_id: actor.userId,
    action: body.forceReset ? "draw.reset" : "draw.generate",
    entity_type: "tournament",
    entity_id: body.tournamentId,
    reason: body.reason ?? null,
    new_value: {
      capacity: draw.capacity,
      corners: body.cornerTeamIds,
      slots: draw.slots,
    },
  });

  return NextResponse.json({ ok: true, draw, matches: createdMatches });
}
