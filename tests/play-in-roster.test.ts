import { describe, expect, it } from "vitest";
import { demoTournament } from "../src/lib/demo-data";
import { configurePlayInRoster } from "../src/lib/play-in-roster";
import { legacyPlayInDraw } from "./fixtures/play-in-draw";
describe("requested play-in roster",()=>{
 it("assigns the specified pairs without losing or duplicating any players",()=>{
  const state=configurePlayInRoster(legacyPlayInDraw());
  expect(state.playInMatch!.teamA!.players.map(p=>p.login)).toEqual(["moguenia","aech-che"]);
  expect(state.playInMatch!.teamB!.players.map(p=>p.login)).toEqual(["yoabied","aait-idi"]);
  expect(state.teams.flatMap(t=>t.players)).toHaveLength(34);
  expect(new Set(state.teams.flatMap(t=>t.players.map(p=>p.id))).size).toBe(34);
 });
 it("keeps all draw slots, match IDs, schedules and unaffected teams",()=>{
  const original=legacyPlayInDraw();original.playInMatch!.court="Court 1";original.playInMatch!.scheduledAt="2026-10-24T10:00:00Z";
  const state=configurePlayInRoster(original);
  expect(state.matches.map(m=>[m.id,m.teamA?.id,m.teamB?.id,m.nextMatchId,m.nextSlot])).toEqual(original.matches.map(m=>[m.id,m.teamA?.id,m.teamB?.id,m.nextMatchId,m.nextSlot]));
  expect(state.teams.slice(0,4)).toEqual(original.teams.slice(0,4));
  expect(state.playInMatch?.court).toBe("Court 1");expect(state.playInMatch?.scheduledAt).toBe(original.playInMatch?.scheduledAt);
  expect(state.matches.some(m=>m.status==="bye")).toBe(false);
 });
 it("is idempotent and never mutates its input",()=>{
  expect(configurePlayInRoster(demoTournament)).toBe(demoTournament);
  const state=legacyPlayInDraw(),before=structuredClone(state);configurePlayInRoster(state);expect(state).toEqual(before);
 });
 it.each(["live","completed"] as const)("preserves a %s play-in and its scores",status=>{
  const state=legacyPlayInDraw();state.playInMatch!.status=status;state.playInMatch!.gamesA=3;
  expect(configurePlayInRoster(state)).toBe(state);
 });
 it("preserves a started main-draw donor match and custom player names",()=>{
  const state=legacyPlayInDraw();const donor=state.matches.find(m=>[m.teamA,m.teamB].some(t=>t?.players.some(p=>p.login==="moguenia")))!;
  donor.status="live";expect(configurePlayInRoster(state)).toBe(state);
  donor.status="upcoming";const player=state.teams.flatMap(t=>t.players).find(p=>p.login==="moguenia")!;player.name="Custom name";
  expect(configurePlayInRoster(state).playInMatch?.teamA?.players[0].name).toBe("Custom name");
 });
});
