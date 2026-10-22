export const dynamic = "force-dynamic";
import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicTournamentState } from "@/lib/tournament/repository";

export default async function TeamsPage() {
  const state = await getPublicTournamentState();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Doubles Teams</h1>
      {state.teams.length === 0 ? (
        <Card><CardDescription>No teams published yet.</CardDescription></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {state.teams.map((team) => (
            <Card key={team.id}>
              <CardTitle>
                <Link href={`/teams/${team.id}`} className="hover:text-emerald-300">{team.display_name}</Link>
              </CardTitle>
              <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                {(team.team_members ?? []).map((member) => {
                  const player = Array.isArray(member.players) ? member.players[0] : member.players;
                  return (
                    <li key={`${team.id}-${member.player_id}`}>
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
          ))}
        </div>
      )}
    </section>
  );
}
