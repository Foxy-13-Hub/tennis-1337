import type { Match, Team } from "./types";

export type CornerTeams = {
  topLeft: string;
  bottomLeft: string;
  topRight: string;
  bottomRight: string;
};

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Corner mapping uses the outermost positions of the first round:
 * top-left = first slot, bottom-left = last slot on left half,
 * top-right = first slot on right half, bottom-right = last slot.
 */
export function generateBracket(teams: Team[], corners: CornerTeams, random = Math.random): Match[] {
  const required = [corners.topLeft, corners.bottomLeft, corners.topRight, corners.bottomRight];
  if (new Set(required).size !== 4) throw new Error("Choose four different corner teams.");
  if (teams.length < 4) throw new Error("At least four teams are required.");
  const byId = new Map(teams.map(t => [t.id, t]));
  if (required.some(id => !byId.has(id))) throw new Error("A selected corner team does not exist.");
  const capacity = 2 ** Math.ceil(Math.log2(teams.length));
  const firstRound: (Team | null)[] = Array(capacity).fill(null);
  const half = capacity / 2;
  firstRound[0] = byId.get(corners.topLeft)!;
  firstRound[half - 1] = byId.get(corners.bottomLeft)!;
  firstRound[half] = byId.get(corners.topRight)!;
  firstRound[capacity - 1] = byId.get(corners.bottomRight)!;
  const reserved = new Set(required);
  const rest = shuffle(teams.filter(t => !reserved.has(t.id)), random);
  let cursor = 0;
  for (let i = 0; i < capacity; i++) {
    if (!firstRound[i] && cursor < rest.length) firstRound[i] = rest[cursor++];
  }
  // Remaining slots are byes. Pairing is fixed after this one-time generation.
  const matches: Match[] = [];
  let currentIds: string[] = [];
  const rounds = Math.log2(capacity);
  for (let r = 1; r <= rounds; r++) {
    const count = capacity / (2 ** r);
    const ids: string[] = [];
    for (let pos = 0; pos < count; pos++) {
      const id = `r${r}-m${pos + 1}`;
      ids.push(id);
      const teamA = r === 1 ? firstRound[pos * 2] : null;
      const teamB = r === 1 ? firstRound[pos * 2 + 1] : null;
      const nextMatchId = r < rounds ? `r${r + 1}-m${Math.floor(pos / 2) + 1}` : undefined;
      const nextSlot = r < rounds ? (pos % 2 === 0 ? "A" : "B") as "A" | "B" : undefined;
      const match: Match = {
        id, round:r, position:pos, teamA, teamB, setsA:[], setsB:[],
        status: (!teamA || !teamB) ? "bye" : "upcoming", nextMatchId, nextSlot
      };
      if (r === 1 && (!!teamA !== !!teamB)) {
        const advancing = teamA || teamB;
        if (advancing && nextMatchId) {
          // Bye progression is stored as a winner without fabricating a played score.
          match.winnerId = advancing.id;
        }
      }
      matches.push(match);
    }
    currentIds = ids;
  }
  // Propagate first-round bye teams through the bracket. A downstream slot is
  // filled only when it is empty, and the bye is never represented as a score.
  const index = new Map(matches.map((m, i) => [m.id, i]));
  for (const match of matches.filter(m => m.round === 1 && m.status === "bye" && m.winnerId)) {
    const winner = match.teamA?.id === match.winnerId ? match.teamA : match.teamB;
    const next = match.nextMatchId ? matches[index.get(match.nextMatchId)!] : undefined;
    if (winner && next && match.nextSlot === "A") next.teamA = winner;
    if (winner && next && match.nextSlot === "B") next.teamB = winner;
  }
  return matches;
}

export function winnerFromBestOfThree(setsA: number[], setsB: number[]): "A" | "B" {
  if (setsA.length !== setsB.length || setsA.length < 2 || setsA.length > 3) {
    throw new Error("A best-of-three result must contain two or three completed sets.");
  }
  let a = 0, b = 0;
  for (let i = 0; i < setsA.length; i++) {
    const x = setsA[i], y = setsB[i];
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x === y) {
      throw new Error("Each set must have valid, non-tied scores.");
    }
    if (Math.max(x, y) < 6 || Math.abs(x - y) < 2) {
      const tiebreakWin = Math.max(x, y) === 7 && Math.min(x, y) === 6;
      if (!tiebreakWin) throw new Error(`Invalid set score: ${x}-${y}.`);
    }
    if (x > y) a++; else b++;
  }
  if (a === b || Math.max(a,b) !== 2) throw new Error("The score must identify exactly one winner with two sets.");
  if ((a === 2 || b === 2) && setsA.length !== (a === 2 ? setsA.length : setsB.length)) {
    throw new Error("Invalid score.");
  }
  return a > b ? "A" : "B";
}
