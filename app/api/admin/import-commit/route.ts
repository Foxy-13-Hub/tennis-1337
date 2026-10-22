import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { pairIndividuals, previewImport } from "@/lib/tournament/importer";

export async function POST(request: Request) {
  const actor = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });
  }

  const body = (await request.json()) as { tournamentId?: string; content?: string };
  if (!body.tournamentId || !body.content) {
    return NextResponse.json({ error: "tournamentId and content are required" }, { status: 400 });
  }

  const preview = previewImport(body.content);
  if (preview.errors.length > 0 || preview.unmatchedPlayers.length > 0) {
    return NextResponse.json({ error: "Import contains validation errors", preview }, { status: 422 });
  }

  const teams =
    preview.mode === "individuals"
      ? pairIndividuals(preview.parsedRows).map((pair, index) => ({
          name: `Team ${index + 1}`,
          players: [pair.playerA, pair.playerB],
        }))
      : preview.parsedRows
          .filter((row) => row.partnerLogin)
          .map((row, index) => ({
            name: `Team ${index + 1}`,
            players: [row.login, row.partnerLogin as string],
          }));

  const playersMap = new Map(preview.parsedRows.map((row) => [row.login, row.displayName]));
  for (const team of teams) {
    for (const login of team.players) {
      if (!playersMap.has(login)) {
        playersMap.set(login, login);
      }
    }
  }

  const playersToUpsert = Array.from(playersMap.entries()).map(([login, displayName]) => ({
    login,
    display_name: displayName,
  }));

  const { data: upsertedPlayers, error: playerError } = await supabase
    .from("players")
    .upsert(playersToUpsert, { onConflict: "login" })
    .select("id, login");

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 500 });
  }

  const idByLogin = new Map((upsertedPlayers ?? []).map((item) => [item.login, item.id]));

  const createdTeamIds: string[] = [];

  for (const [index, team] of teams.entries()) {
    const { data: createdTeam, error: teamError } = await supabase
      .from("teams")
      .insert({
        tournament_id: body.tournamentId,
        display_name: team.name,
      })
      .select("id")
      .single();

    if (teamError || !createdTeam) {
      return NextResponse.json({ error: teamError?.message ?? "Failed to create team" }, { status: 500 });
    }

    createdTeamIds.push(createdTeam.id);

    const members = team.players.map((login, memberIndex) => ({
      team_id: createdTeam.id,
      player_id: idByLogin.get(login),
      member_order: memberIndex,
    }));

    const invalidMember = members.some((member) => !member.player_id);
    if (invalidMember) {
      return NextResponse.json({ error: "Player mapping failed during import" }, { status: 500 });
    }

    const { error: memberError } = await supabase.from("team_members").insert(members as { team_id: string; player_id: string; member_order: number }[]);
    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    await supabase.from("audit_events").insert({
      tournament_id: body.tournamentId,
      actor_user_id: actor.userId,
      action: "import.team_created",
      entity_type: "team",
      entity_id: createdTeam.id,
      new_value: { teamName: team.name, players: team.players, ordinal: index + 1 },
    });
  }

  return NextResponse.json({ ok: true, createdTeamIds, preview });
}
