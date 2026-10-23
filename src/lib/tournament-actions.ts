import { z } from "zod";
import type { Match, Team, Tournament } from "./types";

const scoringRulesSchema = z.object({ bestOf: z.union([z.literal(3), z.literal(5)]), tiebreak: z.boolean(), decidingSetTiebreak: z.boolean() });
const defaultRules = { bestOf: 3, tiebreak: true, decidingSetTiebreak: true } as const;
function completedSetIsValid(a: number, b: number, tiebreak: boolean) {
  if (![a,b].every(value => Number.isInteger(value) && value >= 0 && value <= 100)) return false;
  const high = Math.max(a,b), low = Math.min(a,b);
  return tiebreak ? (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6)) : high >= 6 && high - low === 2;
}
const games = z.number().int().min(0).max(100);
export const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), matchId: z.string().min(1) }),
  z.object({ action: z.literal("liveScore"), matchId: z.string().min(1), gamesA: games, gamesB: games }),
  z.object({ action: z.literal("completeSet"), matchId: z.string().min(1), setNumber: z.number().int().min(1).max(5) }),
  z.object({ action: z.literal("end"), matchId: z.string().min(1) }),
  z.object({ action: z.literal("schedule"), matchId: z.string().min(1), scheduledAt: z.string().datetime({ offset: true }).nullable(), court: z.string().trim().max(80).nullable() }),
  z.object({ action: z.literal("rename"), login: z.string().min(1).max(80), name: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal("score"), matchId: z.string().min(1), setsA: z.number().int().min(0).max(3), setsB: z.number().int().min(0).max(3) }),
]);
export class TournamentInputError extends Error {}
const placeholder = (): Team => ({
  id: "team-play-in-winner", name: "Winner of play-in",
  players: [
    { id: "play-in-winner-a", name: "Play-in winner", image: "/players/default.svg" },
    { id: "play-in-winner-b", name: "Play-in winner", image: "/players/default.svg" },
  ],
});
function reset(match: Match) {
  match.gamesA = 0; match.gamesB = 0; match.setHistory = []; delete match.scoreUpdatedAt;
  match.setsA = []; match.setsB = []; delete match.winnerId; match.status = "upcoming";
}
function clearDownstream(state: Tournament, match: Match) {
  let current = match;
  const visited = new Set<string>();
  while (current.nextMatchId) {
    if (visited.has(current.id)) throw new TournamentInputError("Invalid bracket dependency cycle.");
    visited.add(current.id);
    const next = state.matches.find(candidate => candidate.id === current.nextMatchId);
    if (!next || !current.nextSlot) throw new TournamentInputError("Invalid bracket dependency.");
    if (current.nextSlot === "A") next.teamA = null; else next.teamB = null;
    reset(next); current = next;
  }
}
function updateStatus(state: Tournament) {
  const final = state.matches.find(candidate => !candidate.nextMatchId);
  const matches = [...state.matches, ...(state.playInMatch ? [state.playInMatch] : [])];
  state.status = final?.status === "completed" && !!final.winnerId ? "completed" :
    matches.some(candidate => candidate.status === "completed" || candidate.status === "live") ? "in_progress" : "upcoming";
}
export function applyTournamentAction(input: Tournament, rawAction: unknown): Tournament {
  const parsed = updateSchema.safeParse(rawAction);
  if (!parsed.success) throw new TournamentInputError("Invalid tournament update.");
  const action = parsed.data;
  const state = structuredClone(input);
  const matches = [...state.matches, ...(state.playInMatch ? [state.playInMatch] : [])];
  if (action.action === "rename") {
    const player = state.teams.flatMap(team => team.players).find(player => (player.login || player.name).toLowerCase() === action.login.toLowerCase());
    if (!player) throw new TournamentInputError("Player not found.");
    const teams = [...state.teams, ...matches.flatMap(match => [match.teamA, match.teamB]).filter((team): team is Team => !!team)];
    for (const team of teams) {
      for (const member of team.players) if (member.id === player.id) member.name = action.name;
      team.name = team.players.map(member => member.name).join(" + ");
    }
    return state;
  }
  const match = matches.find(match => match.id === action.matchId);
  if (!match) throw new TournamentInputError("Match not found.");
  if (action.action === "schedule") {
    match.scheduledAt = action.scheduledAt || undefined; match.court = action.court || undefined;
    return state;
  }
  if (["start", "liveScore", "completeSet", "end"].includes(action.action)) {
    if (!match.teamA || !match.teamB || match.teamA.id === match.teamB.id ||
      ![match.teamA, match.teamB].every(team => state.teams.some(candidate => candidate.id === team.id))) {
      throw new TournamentInputError("Both eligible teams must be assigned before starting a match.");
    }
    const config = scoringRulesSchema.safeParse(state.scoringConfig ?? defaultRules);
    if (!config.success) throw new TournamentInputError("Invalid tournament scoring configuration.");
    const rules = config.data;
    const required = Math.floor(rules.bestOf / 2) + 1;
    const won = Math.max(match.setsA.length, match.setsB.length) >= required;
    if (action.action === "start") {
      if (match.status !== "upcoming" && match.status !== "postponed") throw new TournamentInputError("Only pending matches can be started.");
      reset(match); match.status = "live";
    } else {
      if (match.status !== "live") throw new TournamentInputError("Only LIVE matches can be scored.");
      if (action.action === "liveScore") {
        if (won) throw new TournamentInputError("The required sets are won. End the match.");
        match.gamesA = action.gamesA; match.gamesB = action.gamesB;
      } else if (action.action === "completeSet") {
        if (won) throw new TournamentInputError("The required sets are already won.");
        if (action.setNumber !== (match.setHistory?.length ?? 0) + 1) throw new TournamentInputError("This set was already recorded. Reload the match.");
        const a = match.gamesA ?? 0, b = match.gamesB ?? 0;
        const deciding = action.setNumber === rules.bestOf;
        const tiebreak = deciding ? rules.decidingSetTiebreak : rules.tiebreak;
        const valid = completedSetIsValid(a, b, tiebreak);
        if (!valid) throw new TournamentInputError("Invalid completed set: win by two games from six, or 7–6 with a tiebreak.");
        match.setHistory = [...(match.setHistory ?? []), { gamesA: a, gamesB: b }];
        (a > b ? match.setsA : match.setsB).push(1);
        match.gamesA = 0; match.gamesB = 0;
      } else if (action.action === "end") {
        if (!won || match.setsA.length === match.setsB.length || (match.gamesA ?? 0) !== 0 || (match.gamesB ?? 0) !== 0 ||
          (match.setHistory?.length ?? 0) !== match.setsA.length + match.setsB.length) throw new TournamentInputError("Record all valid sets before ending the match.");
        let winsA = 0, winsB = 0;
        for (const [index, set] of match.setHistory!.entries()) {
          if (Math.max(winsA, winsB) >= required || !completedSetIsValid(set.gamesA, set.gamesB,
            index + 1 === rules.bestOf ? rules.decidingSetTiebreak : rules.tiebreak)) throw new TournamentInputError("Invalid set history.");
          if (set.gamesA > set.gamesB) winsA++; else winsB++;
        }
        if (winsA !== match.setsA.length || winsB !== match.setsB.length || Math.max(winsA, winsB) !== required) throw new TournamentInputError("Set history does not match the result.");
        const history = match.setHistory!;
        const setsA = [...match.setsA], setsB = [...match.setsB];
        finishResult(state, match, setsA.length, setsB.length, false);
        match.setsA = setsA; match.setsB = setsB; match.setHistory = history;
        match.gamesA = 0; match.gamesB = 0; match.scoreUpdatedAt = new Date().toISOString();
        return state;
      }
    }
    match.scoreUpdatedAt = new Date().toISOString();
    updateStatus(state); return state;
  }
  if (action.action !== "score") throw new TournamentInputError("Invalid action.");
  if (match.status === "live") throw new TournamentInputError("Use live scoring and validated End Match for a LIVE match.");
  const clearing = action.setsA === 0 && action.setsB === 0;
  const required = Math.floor((state.scoringConfig?.bestOf ?? 3) / 2) + 1;
  if (!clearing && (Math.max(action.setsA, action.setsB) !== required || Math.min(action.setsA, action.setsB) >= required)) {
    throw new TournamentInputError(`Enter a valid best-of-${state.scoringConfig?.bestOf ?? 3} result; the winner must win ${required} sets.`);
  }
  if (!clearing && (!match.teamA || !match.teamB || match.teamA.id === match.teamB.id ||
    !state.teams.some(team => team.id === match.teamA!.id) || !state.teams.some(team => team.id === match.teamB!.id))) {
    throw new TournamentInputError("Both eligible teams must be assigned before entering a score.");
  }
  if (match.status === "bye") throw new TournamentInputError("A bye cannot receive a played score.");
  // Retrying an identical result must not erase later matches.
  if ((clearing && match.status === "upcoming" && !match.winnerId && !match.setsA.length && !match.setsB.length) ||
    (!clearing && match.status === "completed" && match.setsA.length === action.setsA && match.setsB.length === action.setsB && match.winnerId === (action.setsA > action.setsB ? match.teamA?.id : match.teamB?.id))) {
    updateStatus(state); return state;
  }

  return finishResult(state, match, action.setsA, action.setsB, clearing);
}
// All result paths share the original bracket correction and advancement logic.
// The caller persists this whole state in one conditional database write.
function finishResult(state: Tournament, match: Match, setsA: number, setsB: number, clearing: boolean): Tournament {
  let playInTarget: Match | undefined;
  let playInSlot: "A" | "B" | undefined;
  if (match.id === state.playInMatch?.id) {
    const ids = new Set(["team-play-in-winner", match.teamA?.id, match.teamB?.id]);
    playInTarget = state.matches.find(candidate => candidate.round === 1 && (ids.has(candidate.teamA?.id) || ids.has(candidate.teamB?.id)));
    if (!playInTarget) throw new TournamentInputError("The play-in destination is missing.");
    playInSlot = ids.has(playInTarget.teamA?.id) ? "A" : "B";
    clearDownstream(state, playInTarget); reset(playInTarget);
    if (playInSlot === "A") playInTarget.teamA = placeholder(); else playInTarget.teamB = placeholder();
  } else clearDownstream(state, match);
  reset(match);
  if (!clearing) {
    match.setsA = Array(setsA).fill(1); match.setsB = Array(setsB).fill(1);
    const winner = setsA > setsB ? match.teamA! : match.teamB!;
    match.winnerId = winner.id; match.status = "completed";
    const next = playInTarget || state.matches.find(candidate => candidate.id === match.nextMatchId);
    const slot = playInSlot || match.nextSlot;
    if (next && slot === "A") next.teamA = winner;
    if (next && slot === "B") next.teamB = winner;
  }
  // Re-resolve automatic advancement after a correction crosses an empty
  // branch in a generated non-power-of-two bracket.
  for (const candidate of [...state.matches].sort((a, b) => a.round - b.round)) {
    const feeders = state.matches.filter(feeder => feeder.nextMatchId === candidate.id);
    if (candidate.round > 1 && (!candidate.teamA || !candidate.teamB) &&
      feeders.length === 2 && feeders.every(feeder => feeder.status === "bye" || feeder.status === "completed")) {
      candidate.status = "bye";
      const winner = candidate.teamA || candidate.teamB;
      candidate.winnerId = winner?.id;
      const next = state.matches.find(next => next.id === candidate.nextMatchId);
      if (next && winner && candidate.nextSlot === "A") next.teamA = winner;
      if (next && winner && candidate.nextSlot === "B") next.teamB = winner;
    }
  }
  updateStatus(state);
  return state;
}
