import { z } from "zod";
import type { Match, Team, Tournament } from "./types";

export const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("schedule"), matchId: z.string().min(1), scheduledAt: z.string().datetime({ offset: true }).nullable(), court: z.string().trim().max(80).nullable() }),
  z.object({ action: z.literal("rename"), login: z.string().min(1).max(80), name: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal("score"), matchId: z.string().min(1), setsA: z.number().int().min(0).max(2), setsB: z.number().int().min(0).max(2) }),
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
  const clearing = action.setsA === 0 && action.setsB === 0;
  if (!clearing && (Math.max(action.setsA, action.setsB) !== 2 || action.setsA === action.setsB)) {
    throw new TournamentInputError("Enter a valid best-of-three result: 2–0, 2–1, 0–2 or 1–2.");
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
    match.setsA = Array(action.setsA).fill(1); match.setsB = Array(action.setsB).fill(1);
    const winner = action.setsA > action.setsB ? match.teamA! : match.teamB!;
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
