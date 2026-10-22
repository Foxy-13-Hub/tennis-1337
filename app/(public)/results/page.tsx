export const dynamic = "force-dynamic";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicTournamentState } from "@/lib/tournament/repository";

export default async function ResultsPage() {
  const state = await getPublicTournamentState();
  const completedMatches = state.matches.filter((match) => match.status === "completed");

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Results</h1>
      {completedMatches.length === 0 ? (
        <Card><CardDescription>No completed matches yet.</CardDescription></Card>
      ) : (
        completedMatches.map((match) => (
          <Card key={match.id} id={match.id}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Round {match.round_number} • Match {match.match_number}</CardTitle>
              <Badge variant="success">Completed</Badge>
            </div>
            <p className="mt-2 text-sm text-zinc-300">{match.score_summary ?? "Score unavailable"}</p>
          </Card>
        ))
      )}
    </section>
  );
}
