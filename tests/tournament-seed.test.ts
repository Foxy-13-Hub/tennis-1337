import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cornerTeamIds, demoTournament } from "../src/lib/demo-data";
import { playerLogins } from "../src/lib/player-logins";

describe("1337 Tennis Open seed", () => {
  it("includes the 34 supplied unique player logins exactly once", () => {
    expect(playerLogins).toHaveLength(34);
    expect(new Set(playerLogins).size).toBe(34);
    expect(demoTournament.teams.flatMap(team => team.players.map(player => player.login))).toHaveLength(34);
    expect(new Set(demoTournament.teams.flatMap(team => team.players.map(player => player.login))).size).toBe(34);
  });
  it("references existing local player images, including placeholders", () => {
    for (const team of demoTournament.teams) {
      for (const player of team.players) expect(existsSync(join(process.cwd(), "public", player.image)), player.image).toBe(true);
    }
  });
  it("keeps the four requested doubles teams fixed", () => {
    const byId = new Map(demoTournament.teams.map(team => [team.id, team]));
    expect(byId.get(cornerTeamIds.topLeft)?.players.map(player => player.login)).toEqual(["amissa", "bdebbagh"]);
    expect(byId.get(cornerTeamIds.bottomLeft)?.players.map(player => player.login)).toEqual(["nel-khal", "masliman"]);
    expect(byId.get(cornerTeamIds.topRight)?.players.map(player => player.login)).toEqual(["amedina", "CHEF-AYOUB"]);
    expect(byId.get(cornerTeamIds.bottomRight)?.players.map(player => player.login)).toEqual(["nikhtib", "meel-bar"]);
  });
  it("pins the requested non-corner play-in teams and builds a 16-slot main bracket", () => {
    expect(demoTournament.playInMatch?.teamA?.players.map(p=>p.name)).toEqual(["Moguenia","Aech-Che"]);
    expect(demoTournament.playInMatch?.teamB?.players.map(p=>p.name)).toEqual(["Yoabied","Ait-Idi"]);
    expect(demoTournament.teams).toHaveLength(17);
    expect(demoTournament.playInMatch?.teamA).toBeTruthy();
    expect(demoTournament.playInMatch?.teamB).toBeTruthy();
    expect(demoTournament.playInMatch?.teamA?.id).not.toBe(demoTournament.playInMatch?.teamB?.id);
    const cornerIds = new Set(Object.values(cornerTeamIds));
    expect(cornerIds.has(demoTournament.playInMatch!.teamA!.id)).toBe(false);
    expect(cornerIds.has(demoTournament.playInMatch!.teamB!.id)).toBe(false);
    expect(demoTournament.matches).toHaveLength(15);
    expect(demoTournament.matches.filter(match => match.round === 1)).toHaveLength(8);
    expect(demoTournament.matches.filter(match => match.round === 2)).toHaveLength(4);
    expect(demoTournament.matches.filter(match => match.round === 3)).toHaveLength(2);
    expect(demoTournament.matches.filter(match => match.round === 4)).toHaveLength(1);
    const firstRoundTeams = demoTournament.matches.filter(match => match.round === 1).flatMap(match => [match.teamA?.id, match.teamB?.id]);
    expect(firstRoundTeams).toContain("team-play-in-winner");
    expect(new Set(firstRoundTeams).size).toBe(16);
  });
});
