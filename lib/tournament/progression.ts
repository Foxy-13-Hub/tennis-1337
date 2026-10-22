import type { Match } from "@/lib/tournament/types";

export type ProgressionUpdate = {
  targetMatchId: string;
  targetSlot: "team1Id" | "team2Id";
  teamId: string | null;
};

export function computeNextSlotFromMatchNumber(matchNumber: number): {
  nextMatchNumber: number;
  slot: "team1Id" | "team2Id";
} {
  const nextMatchNumber = Math.ceil(matchNumber / 2);
  const slot = matchNumber % 2 === 1 ? "team1Id" : "team2Id";
  return { nextMatchNumber, slot };
}

export function enforceCorrectionDependencies(input: {
  upstreamMatch: Match;
  downstreamMatches: Match[];
  newWinnerTeamId: string;
}) {
  const blockedBy = input.downstreamMatches.filter((match) => match.status === "completed");
  if (blockedBy.length > 0) {
    return {
      allowed: false,
      blockedMatchIds: blockedBy.map((item) => item.id),
    };
  }

  return {
    allowed: true,
    blockedMatchIds: [],
  };
}

export function buildAdvancementUpdate(input: {
  match: Match;
  winnerTeamId: string;
  nextRoundMatch: Match | null;
}): ProgressionUpdate | null {
  if (!input.nextRoundMatch) {
    return null;
  }

  const slot = input.match.matchNumber % 2 === 1 ? "team1Id" : "team2Id";
  return {
    targetMatchId: input.nextRoundMatch.id,
    targetSlot: slot,
    teamId: input.winnerTeamId,
  };
}
