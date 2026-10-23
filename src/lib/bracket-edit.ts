import { z } from "zod";
import type { Match, Team, Tournament } from "./types";

export const editSchemas = [
  z.object({ action: z.literal("editTeam"), teamId: z.string().min(1), name: z.string().trim().min(1).max(100), playerIds: z.tuple([z.string(), z.string()]), swapConflicts: z.boolean() }),
  z.object({ action: z.literal("editSlots"), matchId: z.string().min(1), teamA: z.string().min(1), teamB: z.string().min(1), swapConflicts: z.boolean() }),
] as const;
export const editSchema = z.discriminatedUnion("action", editSchemas);
export class BracketEditError extends Error {}
export function allMatches(state: Tournament) { return [...(state.playInMatch ? [state.playInMatch] : []), ...state.matches]; }
function reset(match: Match) {
  match.status = "upcoming"; match.setsA = []; match.setsB = []; match.gamesA = 0; match.gamesB = 0; match.setHistory = [];
  delete match.winnerId; delete match.scoreUpdatedAt;
}
export function playInDestination(state: Tournament) {
  const play = state.playInMatch;
  if (!play) return undefined;
  const ids = new Set(["team-play-in-winner", play.teamA?.id, play.teamB?.id]);
  for (const match of state.matches.filter(m => m.round === 1)) {
    if (ids.has(match.teamA?.id)) return { match, slot: "A" as const };
    if (ids.has(match.teamB?.id)) return { match, slot: "B" as const };
  }
}
const pending = (): Team => ({ id: "team-play-in-winner", name: "Winner of play-in", players: [{ id: "play-in-winner-a", name: "Play-in winner", image: "/players/default.svg" }, { id: "play-in-winner-b", name: "Play-in winner", image: "/players/default.svg" }] });
export function applyBracketEdit(input: Tournament, raw: unknown): Tournament {
  const action = editSchema.parse(raw), state = structuredClone(input);
  const matches = allMatches(state), affected = new Set<string>();
  const destination = playInDestination(state);
  if (action.action === "editTeam") {
    const target = state.teams.find(t => t.id === action.teamId);
    if (!target) throw new BracketEditError("Team not found.");
    if (new Set(action.playerIds).size !== 2) throw new BracketEditError("Choose two different players.");
    const players = new Map(state.teams.flatMap(t => t.players).map(p => [p.id, p]));
    if (action.playerIds.some(id => !players.has(id))) throw new BracketEditError("Player is not in the local tournament roster.");
    const rosterChanged = target.players.some((p, i) => p.id !== action.playerIds[i]);
    const incoming = action.playerIds.filter(id => !target.players.some(p => p.id === id));
    const outgoing = target.players.filter(p => !action.playerIds.includes(p.id));
    for (const [i, id] of incoming.entries()) {
      const donor = state.teams.find(t => t.id !== target.id && t.players.some(p => p.id === id))!;
      if (!action.swapConflicts) throw new BracketEditError(`${players.get(id)!.name} is assigned to ${donor.name}. Enable player swaps to move the displaced player into that team.`);
      donor.players[donor.players.findIndex(p => p.id === id)] = outgoing[i]; affected.add(donor.id);
    }
    target.players = action.playerIds.map(id => players.get(id)!) as Team["players"]; target.name = action.name;
    if (rosterChanged) affected.add(target.id);
    state.rosterManaged = true;
    for (const match of matches) {
      if ([match.teamA, match.teamB].some(t => t && affected.has(t.id))) reset(match);
      for (const slot of ["teamA", "teamB"] as const) if (match[slot]) match[slot] = state.teams.find(t => t.id === match[slot]!.id) ?? match[slot];
    }
  } else {
    const match = matches.find(m => m.id === action.matchId);
    if (!match) throw new BracketEditError("Match not found.");
    if (action.teamA === action.teamB) throw new BracketEditError("A team cannot play itself.");
    if (match.round > 1) throw new BracketEditError("Later-round slots come from feeder winners. Correct the feeder match result to change this slot.");
    const slots = matches.filter(m => m.round <= 1).flatMap(m => (["teamA", "teamB"] as const).map(slot => ({ match: m, slot })) ).filter(s => !(destination && s.match.id === destination.match.id && s.slot === `team${destination.slot}`));
    for (const [slot, id] of [["teamA", action.teamA], ["teamB", action.teamB]] as const) {
      if (destination && match.id === destination.match.id && slot === `team${destination.slot}`) {
        if (id !== match[slot]?.id) throw new BracketEditError("Slot 16 is controlled by the play-in winner. Correct the play-in participants or result.");
        continue;
      }
      const team = state.teams.find(t => t.id === id);
      if (!team) throw new BracketEditError("Choose an eligible team.");
      if (match[slot]?.id === id) continue;
      const other = slots.find(s => s.match[s.slot]?.id === id);
      if (other) {
        if (!action.swapConflicts) throw new BracketEditError(`${team.name} already occupies ${other.match.id}. Enable slot swaps to exchange the teams.`);
        other.match[other.slot] = match[slot]; reset(other.match);
      }
      match[slot] = team; reset(match);
    }
    state.rosterManaged = true;
  }
  // Reconcile each derived slot in dependency order. Reset only matches whose
  // participants changed, preserving results on every independent branch.
  if (state.playInMatch && destination) {
    const play = state.playInMatch;
    const team = [play.teamA, play.teamB].find(t => t?.id === play.winnerId) ?? pending();
    const slot = destination.slot === "A" ? "teamA" : "teamB";
    if (destination.match[slot]?.id !== team.id) { destination.match[slot] = team; reset(destination.match); }
  }
  for (const feeder of [...state.matches].sort((a,b) => a.round-b.round)) {
    if (!feeder.nextMatchId || !feeder.nextSlot) continue;
    const next = state.matches.find(m => m.id === feeder.nextMatchId);
    if (!next) throw new BracketEditError("Invalid bracket dependency.");
    const winner = [feeder.teamA, feeder.teamB].find(t => t?.id === feeder.winnerId) ?? null;
    const slot = feeder.nextSlot === "A" ? "teamA" : "teamB";
    if (next[slot]?.id !== winner?.id) { next[slot] = winner; reset(next); }
  }
  const final = state.matches.find(m => !m.nextMatchId);
  state.status = final?.status === "completed" && final.winnerId ? "completed" : matches.some(m => ["completed", "live"].includes(m.status)) ? "in_progress" : "upcoming";
  return state;
}
export function resultImpacts(before: Tournament, after: Tournament): string[] {
  return allMatches(before).filter(m => {
    const next = allMatches(after).find(n => n.id === m.id)!;
    return (m.status === "completed" || m.status === "live" || m.setsA.length || m.setsB.length || m.gamesA || m.gamesB || m.setHistory?.length) &&
      JSON.stringify([m.teamA?.id,m.teamB?.id,m.status,m.winnerId,m.setsA,m.setsB,m.gamesA,m.gamesB,m.setHistory]) !== JSON.stringify([next.teamA?.id,next.teamB?.id,next.status,next.winnerId,next.setsA,next.setsB,next.gamesA,next.gamesB,next.setHistory]);
  }).map(m => `${m.id}: ${m.teamA?.name ?? "TBD"} vs ${m.teamB?.name ?? "TBD"} (${m.status}, ${m.setsA.length}–${m.setsB.length})`);
}
