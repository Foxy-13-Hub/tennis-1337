import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type TeamRef = {
  id: string | null;
  label: string;
};

type MatchCardProps = {
  id: string;
  roundNumber: number;
  matchNumber: number;
  status: string;
  scoreSummary: string | null;
  team1: TeamRef;
  team2: TeamRef;
  winnerTeamId: string | null;
};

export function MatchCard({ id, roundNumber, matchNumber, status, scoreSummary, team1, team2, winnerTeamId }: MatchCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">R{roundNumber} • M{matchNumber}</p>
        <Badge variant={status === "completed" ? "success" : status === "postponed" ? "warning" : "neutral"}>{status}</Badge>
      </div>
      <div className="space-y-2 text-sm text-zinc-100">
        <p className={winnerTeamId === team1.id ? "font-semibold text-emerald-300" : ""}>{team1.id ? <Link href={`/teams/${team1.id}`}>{team1.label}</Link> : "TBD"}</p>
        <p className={winnerTeamId === team2.id ? "font-semibold text-emerald-300" : ""}>{team2.id ? <Link href={`/teams/${team2.id}`}>{team2.label}</Link> : "TBD"}</p>
      </div>
      <p className="text-xs text-zinc-400">{scoreSummary || "No score yet"}</p>
      <Link href={`/results#${id}`} className="text-xs text-emerald-300 hover:text-emerald-200">
        Match details
      </Link>
    </Card>
  );
}
