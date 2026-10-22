export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicTournamentState } from "@/lib/tournament/repository";

export default async function TeamDetailsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const state = await getPublicTournamentState();
  const team = state.teams.find((item) => item.id === teamId);

  if (!team) {
    notFound();
  }

  const relatedMatches = state.matches.filter((match) => match.team1_id === team.id || match.team2_id === team.id);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{team.display_name}</h1>
      <Card>
        <CardTitle>Team Members</CardTitle>
        <ul className="mt-3 space-y-1 text-sm text-zinc-200">
          {(team.team_members ?? []).map((member) => {
            const player = Array.isArray(member.players) ? member.players[0] : member.players;
            return (
              <li key={member.player_id}>
                {player?.login ? (
                  <Link href={`/players/${player.login}`} className="hover:text-emerald-300">{player.display_name} ({player.login})</Link>
                ) : (
                  member.player_id
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardTitle>Matches</CardTitle>
        {relatedMatches.length === 0 ? <CardDescription>No matches yet.</CardDescription> : relatedMatches.map((match) => <p key={match.id} className="text-sm">Round {match.round_number}, Match {match.match_number} — {match.status}</p>)}
      </Card>
    </section>
  );
}
