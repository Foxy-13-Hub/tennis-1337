import { z } from "zod";

const setSchema = z.object({
  team1Games: z.number().int().min(0).max(7),
  team2Games: z.number().int().min(0).max(7),
  team1Tiebreak: z.number().int().min(0).max(20).nullable().optional(),
  team2Tiebreak: z.number().int().min(0).max(20).nullable().optional(),
});

const scoreInputSchema = z.object({
  sets: z.array(setSchema).min(2).max(3),
  bestOf: z.number().int().min(1).max(5).default(3),
});

function isLegalSetScore(team1: number, team2: number) {
  const maxGames = Math.max(team1, team2);
  const minGames = Math.min(team1, team2);

  if (maxGames < 6) return false;
  if (maxGames === 6) return minGames <= 4;
  if (maxGames === 7) return minGames === 5 || minGames === 6;
  return false;
}

export function validateTennisScore(input: z.input<typeof scoreInputSchema>) {
  const parsed = scoreInputSchema.parse(input);
  const requiredSetsToWin = Math.floor(parsed.bestOf / 2) + 1;

  let team1SetsWon = 0;
  let team2SetsWon = 0;

  parsed.sets.forEach((set, index) => {
    if (!isLegalSetScore(set.team1Games, set.team2Games)) {
      throw new Error(`Invalid score in set ${index + 1}`);
    }

    if (set.team1Games === set.team2Games) {
      throw new Error(`Set ${index + 1} cannot end in a tie`);
    }

    if (set.team1Games > set.team2Games) team1SetsWon += 1;
    if (set.team2Games > set.team1Games) team2SetsWon += 1;
  });

  const winner = team1SetsWon > team2SetsWon ? "team1" : "team2";
  const loserSets = Math.min(team1SetsWon, team2SetsWon);

  if (Math.max(team1SetsWon, team2SetsWon) < requiredSetsToWin) {
    throw new Error("Submitted score is incomplete for best-of format");
  }

  if (loserSets >= requiredSetsToWin) {
    throw new Error("Impossible final score: both teams reached winning threshold");
  }

  return {
    winner,
    summary: parsed.sets
      .map((set) => `${set.team1Games}-${set.team2Games}`)
      .join(", "),
    sets: parsed.sets,
  } as const;
}
