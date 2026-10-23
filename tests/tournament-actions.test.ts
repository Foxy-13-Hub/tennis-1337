import { describe, expect, it } from "vitest";
import { applyTournamentAction, updateSchema } from "../src/lib/tournament-actions";
import { demoTournament } from "../src/lib/demo-data";
import { generateBracket, winnerFromBestOfThree } from "../src/lib/bracket";
import type { Team, Tournament } from "../src/lib/types";
const score = (state: Tournament, matchId: string, setsA = 2, setsB = 0) => applyTournamentAction(state, { action: "score", matchId, setsA, setsB });
const team = (id: string): Team => ({ id, name: id, players: [{ id: id + "a", name: id, image: "" }, { id: id + "b", name: id, image: "" }] });
const corners = { topLeft: "t1", bottomLeft: "t2", topRight: "t3", bottomRight: "t4" };
function complete(initial: Tournament) {
  let state = structuredClone(initial);
  if (state.playInMatch) state = score(state, state.playInMatch.id);
  for (const match of state.matches) if (match.status !== "bye") state = score(state, match.id);
  return state;
}
describe("result lifecycle", () => {
  it("completes the actual 17-team draw in 16 played matches and derives its champion", () => {
    const state = complete(demoTournament);
    expect(state.status).toBe("completed");
    expect([...state.matches, state.playInMatch!].filter(match => match.status === "completed")).toHaveLength(16);
    expect(state.matches.at(-1)?.winnerId).toBeTruthy();
    expect(demoTournament.status).toBe("upcoming");
  });
  it("rejects unresolved and placeholder opponents even when the populated side wins", () => {
    expect(() => score(demoTournament, "r2-m1")).toThrow(/Both eligible/);
    const target = demoTournament.matches.find(match => match.teamA?.id === "team-play-in-winner" || match.teamB?.id === "team-play-in-winner")!;
    expect(() => score(demoTournament, target.id)).toThrow(/Both eligible/);
    expect(() => score(demoTournament, target.id, 0, 2)).toThrow(/Both eligible/);
  });
  it("treats repeated results as an idempotent operation", () => {
    const state = complete(demoTournament);
    expect(score(state, "r1-m1")).toEqual(state);
    expect(score(state, state.playInMatch!.id)).toEqual(state);
  });
  it.each([false, true])("invalidates the entire play-in path on correction/clear (%s)", clearing => {
    const original = complete(demoTournament);
    const playIn = original.playInMatch!;
    const target = original.matches.find(match => match.round === 1 && [match.teamA?.id, match.teamB?.id].includes(playIn.winnerId))!;
    const state = score(original, playIn.id, clearing ? 0 : 1, clearing ? 0 : 2);
    expect(state.status).toBe("in_progress");
    let current = state.matches.find(match => match.id === target.id)!;
    expect(current.winnerId).toBeUndefined();
    expect([current.teamA?.id, current.teamB?.id]).toContain(clearing ? "team-play-in-winner" : playIn.teamB!.id);
    while (current.nextMatchId) {
      current = state.matches.find(match => match.id === current.nextMatchId)!;
      expect(current.winnerId).toBeUndefined();
      expect(current.setsA).toEqual([]);
      expect(current.status).toBe("upcoming");
    }
    expect(original.status).toBe("completed");
  });
  it("an explicit resubmission repairs a contradictory winner and stale tournament status", () => {
    const original = complete(demoTournament);
    original.matches[0].winnerId = original.matches[0].teamB!.id;
    original.status = "upcoming";
    const state = score(original, "r1-m1");
    expect(state.matches[0].winnerId).toBe(state.matches[0].teamA?.id);
    expect(state.matches.at(-1)?.winnerId).toBeUndefined();
    expect(state.status).toBe("in_progress");
    const completed = complete(demoTournament); completed.status = "upcoming";
    expect(score(completed, "r1-m1").status).toBe("completed");
  });
  it("clears only the affected branch after an early result correction", () => {
    const original = complete(demoTournament);
    const state = score(original, "r1-m1", 1, 2);
    expect(state.matches.find(match => match.id === "r2-m1")?.teamA?.id).toBe(state.matches[0].teamB?.id);
    expect(state.matches.find(match => match.id === "r2-m1")?.winnerId).toBeUndefined();
    expect(state.matches.find(match => match.id === "r2-m2")).toEqual(original.matches.find(match => match.id === "r2-m2"));
    expect(state.matches.at(-1)?.winnerId).toBeUndefined();
  });
  it("supports clearing, restarting, and serialization without mutating the seed", () => {
    let state = complete(demoTournament);
    for (const match of state.matches) state = score(state, match.id, 0, 0);
    state = score(state, state.playInMatch!.id, 0, 0);
    expect(state.status).toBe("upcoming");
    expect(complete(JSON.parse(JSON.stringify(state))).status).toBe("completed");
  });
  it.each([[null, 0], [-1, 2], [2.5, 1], [Infinity, 0], [3, 0], [1, 1], [2, 2], [1, 0], ["2", 0]])("rejects invalid aggregate score %s:%s", (setsA, setsB) => {
    expect(() => applyTournamentAction(demoTournament, { action: "score", matchId: "r1-m1", setsA, setsB })).toThrow();
  });
  it("rejects malformed dates and keeps schedule edits independent of results", () => {
    expect(updateSchema.safeParse({ action: "schedule", matchId: "r1-m1", scheduledAt: "garbage", court: null }).success).toBe(false);
    const original = complete(demoTournament);
    const state = applyTournamentAction(original, { action: "schedule", matchId: "r1-m1", scheduledAt: "2026-10-23T10:30:00Z", court: " Court 1 " });
    expect(state.matches[0].court).toBe("Court 1");
    expect(state.matches.at(-1)).toEqual(original.matches.at(-1));
  });
  it("renames the same stable player throughout results without altering identities", () => {
    const original = complete(demoTournament);
    const state = applyTournamentAction(original, { action: "rename", login: "amissa", name: "New name" });
    const copies = [...state.teams, ...state.matches.flatMap(match => [match.teamA, match.teamB]).filter((team): team is Team => !!team)].flatMap(team => team.players).filter(player => player.login === "amissa");
    expect(copies.every(player => player.name === "New name" && player.id === "player-amissa")).toBe(true);
    expect(state.matches.at(-1)?.winnerId).toBe(original.matches.at(-1)?.winnerId);
  });
});
describe("generated brackets", () => {
  it.each([4, 5, 6, 7, 8, 9, 10, 13, 16, 17, 25, 32, 33, 64])("resolves %i teams including byes", count => {
    const teams = Array.from({ length: count }, (_, i) => team(`t${i + 1}`));
    const matches = generateBracket(teams, corners, () => 0.4);
    expect(matches).toHaveLength(2 ** Math.ceil(Math.log2(count)) - 1);
    const firstIds = matches.filter(match => match.round === 1).flatMap(match => [match.teamA?.id, match.teamB?.id]).filter(Boolean);
    expect(new Set(firstIds).size).toBe(count);
    expect(matches.filter(match => match.round > 1 && !match.teamA && !match.teamB && match.status === "bye").every(match => !match.winnerId)).toBe(true);
    const state = complete({ name: "Test", status: "upcoming", teams, matches });
    expect(state.matches.at(-1)?.winnerId).toBeTruthy();
    expect(state.matches.filter(match => match.status === "completed")).toHaveLength(count - 1);
  });
  it.each([0, 1, 2, 3])("rejects %i teams under the existing four-corner rule", count => {
    expect(() => generateBracket(Array.from({ length: count }, (_, i) => team(`t${i + 1}`)), corners)).toThrow();
  });
  it.each([5, 9, 17, 33])("replays a corrected %i-team bracket with byes", count => {
    const teams = Array.from({ length: count }, (_, i) => team(`t${i + 1}`));
    const original = complete({ name: "Test", status: "upcoming", teams, matches: generateBracket(teams, corners, () => 0.4) });
    const first = original.matches.find(match => match.round === 1 && match.status === "completed")!;
    let state = score(original, first.id, 0, 2);
    for (const id of state.matches.map(match => match.id)) {
      const match = state.matches.find(match => match.id === id)!;
      if (match.status === "upcoming" && match.teamA && match.teamB) state = score(state, id);
    }
    expect(state.status).toBe("completed");
    expect(state.matches.filter(match => match.status === "completed")).toHaveLength(count - 1);
  });
  it("rejects duplicate teams and duplicate players", () => {
    const teams = Array.from({ length: 4 }, (_, i) => team(`t${i + 1}`));
    expect(() => generateBracket([...teams, teams[0]], corners)).toThrow(/unique/);
    teams[1].players[0] = teams[0].players[0];
    expect(() => generateBracket(teams, corners)).toThrow(/unique/);
  });
});
describe("individual tennis set validation", () => {
  it.each([[[6, 6], [0, 4]], [[7, 6, 7], [6, 7, 5]]])("accepts completed sets %j vs %j", (a, b) => expect(winnerFromBestOfThree(a, b)).toBe("A"));
  it.each([[[6, 6, 0], [0, 0, 6]], [[100, 6], [0, 0]], [[8, 6], [6, 0]], [[6, 6], [5, 0]], [[6], [0]], [[6, 6], [0]], [[-1, 6], [0, 0]], [[6.5, 6], [0, 0]], [[6, 0], [0, 6]]])("rejects invalid sequence %j vs %j", (a, b) => expect(() => winnerFromBestOfThree(a, b)).toThrow());
});
