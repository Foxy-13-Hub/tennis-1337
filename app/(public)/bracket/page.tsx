export const dynamic = "force-dynamic";
import { MatchCard } from "@/components/match-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicTournamentState } from "@/lib/tournament/repository";

export default async function BracketPage() {
  const state = await getPublicTournamentState();

  if (!state.tournament) {
    return (
      <Card>
        <CardTitle>Bracket unavailable</CardTitle>
        <CardDescription>No tournament configuration has been published yet.</CardDescription>
      </Card>
    );
  }

  const teamNameMap = new Map(state.teams.map((team) => [team.id, team.display_name]));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Tournament Bracket</h1>
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] gap-4 md:grid-cols-3 lg:grid-cols-4">
          {state.matches.map((match) => (
            <MatchCard
              key={match.id}
              id={match.id}
              roundNumber={match.round_number}
              matchNumber={match.match_number}
              status={match.status}
              scoreSummary={match.score_summary}
              winnerTeamId={match.winner_team_id}
              team1={{ id: match.team1_id, label: match.team1_id ? teamNameMap.get(match.team1_id) ?? "Team" : "TBD" }}
              team2={{ id: match.team2_id, label: match.team2_id ? teamNameMap.get(match.team2_id) ?? "Team" : "TBD" }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
