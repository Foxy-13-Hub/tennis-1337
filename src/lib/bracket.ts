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
  if (teams.some(team => !team.id?.trim() || team.players.length !== 2 ||
    team.players.some(player => !player.id?.trim() || !player.name?.trim()))) {
    throw new Error("Each doubles team needs an ID and two valid players.");
  }
  const playerIds = teams.flatMap(team => team.players.map(player => player.id));
  if (new Set(teams.map(team => team.id)).size !== teams.length || new Set(playerIds).size !== playerIds.length) {
    throw new Error("Teams and players must have unique IDs.");
  }
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
  const rounds = Math.log2(capacity);
  for (let r = 1; r <= rounds; r++) {
    const count = capacity / (2 ** r);
    for (let pos = 0; pos < count; pos++) {
      const id = `r${r}-m${pos + 1}`;
      const teamA = r === 1 ? firstRound[pos * 2] : null;
      const teamB = r === 1 ? firstRound[pos * 2 + 1] : null;
      const nextMatchId = r < rounds ? `r${r + 1}-m${Math.floor(pos / 2) + 1}` : undefined;
      const nextSlot = r < rounds ? (pos % 2 === 0 ? "A" : "B") as "A" | "B" : undefined;
      const match: Match = {
        id, round:r, position:pos, teamA, teamB, setsA:[], setsB:[],
        status: "upcoming", nextMatchId, nextSlot
      };
      matches.push(match);
    }
  }
  // A missing slot is a bye only after its feeder has resolved. Resolve empty
  // branches too, so sparse draws can advance through more than one round.
  const byMatchId = new Map(matches.map(match => [match.id, match]));
  for (const match of matches) {
    const feeders = matches.filter(candidate => candidate.nextMatchId === match.id);
    const resolved = match.round === 1 || feeders.every(feeder => feeder.status === "bye");
    if (resolved && (!match.teamA || !match.teamB)) {
      match.status = "bye";
      const winner = match.teamA || match.teamB;
      match.winnerId = winner?.id;
      const next = match.nextMatchId ? byMatchId.get(match.nextMatchId) : undefined;
      if (next && winner) {
        if (match.nextSlot === "A") next.teamA = winner;
        else next.teamB = winner;
      }
    }
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
    const high = Math.max(x, y), low = Math.min(x, y);
    if (!((high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6)))) {
      throw new Error(`Invalid set score: ${x}-${y}.`);
    }
    if (a === 2 || b === 2) throw new Error("The match has already been decided.");
    if (x > y) a++; else b++;
  }
  if (a === b || Math.max(a,b) !== 2) throw new Error("The score must identify exactly one winner with two sets.");
  return a > b ? "A" : "B";
}
