export const dynamic = "force-dynamic";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicTournamentState } from "@/lib/tournament/repository";

export default async function SchedulePage() {
  const state = await getPublicTournamentState();
  const matches = state.matches.filter((match) => ["pending", "scheduled", "in_progress", "postponed"].includes(match.status));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Match Schedule</h1>
      {matches.length === 0 ? (
        <Card><CardDescription>No scheduled matches yet.</CardDescription></Card>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <Card key={match.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Round {match.round_number} • Match {match.match_number}</CardTitle>
                <Badge>{match.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{match.scheduled_at ? new Date(match.scheduled_at).toLocaleString("en-US", { timeZone: state.tournament?.timezone || "Africa/Casablanca" }) : "Date TBD"} • {match.court || "Court TBD"}</p>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
