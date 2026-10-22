import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getPublicTournamentState() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      tournament: null,
      teams: [],
      matches: [],
      players: [],
    };
  }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, slug, status, timezone, bracket_capacity")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return {
      tournament: null,
      teams: [],
      matches: [],
      players: [],
    };
  }

  const [{ data: teams }, { data: matches }, { data: players }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, display_name, seed, team_members(player_id, member_order, players(id, login, display_name, avatar_url, profile_url))")
      .eq("tournament_id", tournament.id)
      .order("display_name", { ascending: true }),
    supabase
      .from("matches")
      .select("id, round_number, match_number, team1_id, team2_id, winner_team_id, status, scheduled_at, court, score_summary")
      .eq("tournament_id", tournament.id)
      .order("round_number", { ascending: true })
      .order("match_number", { ascending: true }),
    supabase
      .from("players")
      .select("id, login, display_name, avatar_url, profile_url")
      .order("display_name", { ascending: true }),
  ]);

  return {
    tournament,
    teams: teams ?? [],
    matches: matches ?? [],
    players: players ?? [],
  };
}
