import { describe, expect, it } from "vitest";

import { buildAdvancementUpdate, computeNextSlotFromMatchNumber, enforceCorrectionDependencies } from "../lib/tournament/progression";

describe("progression and correction guards", () => {
  it("maps match to next round slot", () => {
    expect(computeNextSlotFromMatchNumber(1)).toEqual({ nextMatchNumber: 1, slot: "team1Id" });
    expect(computeNextSlotFromMatchNumber(2)).toEqual({ nextMatchNumber: 1, slot: "team2Id" });
  });

  it("blocks correction when downstream completed", () => {
    const guard = enforceCorrectionDependencies({
      upstreamMatch: {
        id: "m1",
        tournamentId: "t1",
        roundNumber: 1,
        matchNumber: 1,
        status: "completed",
        team1Id: "a",
        team2Id: "b",
        winnerTeamId: "a",
        scheduledAt: null,
        court: null,
        scoreSummary: "6-4,6-4",
        sets: [],
      },
      downstreamMatches: [
        {
          id: "m2",
          tournamentId: "t1",
          roundNumber: 2,
          matchNumber: 1,
          status: "completed",
          team1Id: "a",
          team2Id: "c",
          winnerTeamId: "a",
          scheduledAt: null,
          court: null,
          scoreSummary: "6-2,6-2",
          sets: [],
        },
      ],
      newWinnerTeamId: "b",
    });

    expect(guard.allowed).toBe(false);
    expect(guard.blockedMatchIds).toEqual(["m2"]);
  });

  it("generates advancement for next round", () => {
    const update = buildAdvancementUpdate({
      match: {
        id: "m1",
        tournamentId: "t1",
        roundNumber: 1,
        matchNumber: 1,
        status: "completed",
        team1Id: "a",
        team2Id: "b",
        winnerTeamId: "a",
        scheduledAt: null,
        court: null,
        scoreSummary: "6-0,6-0",
        sets: [],
      },
      winnerTeamId: "a",
      nextRoundMatch: {
        id: "m2",
        tournamentId: "t1",
        roundNumber: 2,
        matchNumber: 1,
        status: "pending",
        team1Id: null,
        team2Id: null,
        winnerTeamId: null,
        scheduledAt: null,
        court: null,
        scoreSummary: null,
        sets: [],
      },
    });

    expect(update).toEqual({ targetMatchId: "m2", targetSlot: "team1Id", teamId: "a" });
  });
});
