export const dynamic = "force-dynamic";
import { Activity, CalendarClock, Trophy, UsersRound } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicTournamentState } from "@/lib/tournament/repository";

const statusLabel: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  completed: "Completed",
  postponed: "Postponed",
};

export default async function HomePage() {
  const state = await getPublicTournamentState();

  if (!state.tournament) {
    return (
      <Card>
        <CardTitle>Tournament setup pending</CardTitle>
        <CardDescription>The admin must configure the tournament before public data appears.</CardDescription>
      </Card>
    );
  }

  const upcomingMatches = state.matches.filter((match) => ["scheduled", "pending", "in_progress"].includes(match.status)).slice(0, 6);
  const recentResults = state.matches.filter((match) => match.status === "completed").slice(0, 6);
  const completed = recentResults.length;
  const total = state.matches.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardDescription>Status</CardDescription>
          <CardTitle>{statusLabel[state.tournament.status] ?? state.tournament.status}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Teams</CardDescription>
          <CardTitle className="flex items-center gap-2"><UsersRound className="h-4 w-4" />{state.teams.length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Completed Matches</CardDescription>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" />{completed}/{total}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Timezone</CardDescription>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />{state.tournament.timezone}</CardTitle>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Upcoming</CardTitle>
          {upcomingMatches.length === 0 ? (
            <CardDescription>No upcoming matches.</CardDescription>
          ) : (
            upcomingMatches.map((match) => (
              <p key={match.id} className="text-sm text-zinc-200">Round {match.round_number}, Match {match.match_number} — {match.court || "Court TBD"}</p>
            ))
          )}
        </Card>
        <Card className="space-y-2">
          <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" />Recent Results</CardTitle>
          {recentResults.length === 0 ? (
            <CardDescription>No completed matches yet.</CardDescription>
          ) : (
            recentResults.map((match) => (
              <p key={match.id} className="text-sm text-zinc-200">Round {match.round_number}, Match {match.match_number} — {match.score_summary || "Score missing"}</p>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
