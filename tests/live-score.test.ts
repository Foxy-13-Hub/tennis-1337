import { describe, expect, it } from "vitest";
import { applyTournamentAction as apply } from "../src/lib/tournament-actions";
import { demoTournament } from "../src/lib/demo-data";
import { changeGames, scoreLabel } from "../src/lib/live-score";
import type { Tournament } from "../src/lib/types";
const matchId = "r1-m1";
const act = (s: Tournament, action: string, extra = {}) => apply(s, { action, matchId, ...extra });
const start = () => act(demoTournament, "start");
const games = (s: Tournament, gamesA: number, gamesB: number) => act(s, "liveScore", { gamesA, gamesB });
function set(s: Tournament, a = 6, b = 3) {
  return act(games(s, a, b), "completeSet", { setNumber: (s.matches[0].setHistory?.length ?? 0) + 1 });
}
describe("live scoring lifecycle", () => {
  it("initializes and shows 0 [0] with immutable pending input", () => {
    const s = start(); expect(s.matches[0].status).toBe("live"); expect(s.status).toBe("in_progress");
    expect(scoreLabel(s.matches[0], "A")).toBe("0 [0]"); expect(scoreLabel(s.matches[0], "B")).toBe("0 [0]");
    expect(demoTournament.matches[0].status).toBe("upcoming");
  });
  it("increments/decrements each side independently without changing sets", () => {
    let s = start(); s = games(s, changeGames(s.matches[0].gamesA!, 1), 0);
    expect(scoreLabel(s.matches[0], "A")).toBe("0 [1]"); expect(scoreLabel(s.matches[0], "B")).toBe("0 [0]");
    s = games(s, 1, changeGames(s.matches[0].gamesB!, 1));
    expect(scoreLabel(s.matches[0], "B")).toBe("0 [1]");
    s = games(s, changeGames(1, -1), 1); expect(scoreLabel(s.matches[0], "A")).toBe("0 [0]");
    expect(s.matches[0].setsA).toEqual([]); expect(s.matches[0].setsB).toEqual([]); expect(changeGames(0, -1)).toBe(0);
  });
  it("preserves every repeated save through serialization", () => {
    let s = start();
    for (const [a,b] of [[1,0],[2,1],[3,1]]) {
      s = JSON.parse(JSON.stringify(games(s, a, b)));
      expect(scoreLabel(s.matches[0], "A")).toBe(`0 [${a}]`); expect(s.matches[0].gamesB).toBe(b);
    }
  });
  it.each([-1, 0.5, NaN, Infinity, "1", null, 101])("rejects invalid games %s", value => {
    expect(() => act(start(), "liveScore", { gamesA: value, gamesB: 0 })).toThrow();
    expect(() => act(start(), "liveScore", { gamesA: 0, gamesB: value })).toThrow();
  });
  it.each([[6,0],[6,4],[7,5],[7,6],[0,6],[6,7]])("records valid set %i–%i with correct winner and reset", (a,b) => {
    const s = set(start(), a, b), m = s.matches[0];
    expect(m.setsA.length).toBe(a>b ? 1 : 0); expect(m.setsB.length).toBe(b>a ? 1 : 0);
    expect(m.setHistory).toEqual([{gamesA:a,gamesB:b}]); expect(m.gamesA).toBe(0); expect(m.gamesB).toBe(0);
    expect(m.status).toBe("live"); expect(m.winnerId).toBeUndefined();
  });
  it.each([[0,0],[6,5],[6,6],[7,4],[8,6],[5,3]])("rejects incomplete/invalid set %i–%i", (a,b) => expect(() => set(start(), a,b)).toThrow(/Invalid completed set/));
  it("prevents duplicate set completion even after another valid game score", () => {
    const s = games(set(start()), 6, 1);
    expect(() => act(s, "completeSet", {setNumber:1})).toThrow(/already recorded/);
  });
  it("never advances before explicit end; completes and protects the result", () => {
    const s = set(set(start())); expect(s.matches[0].status).toBe("live");
    expect(s.matches.find(m=>m.id==="r2-m1")?.teamA).toBeNull();
    const end = act(s, "end"), m = end.matches[0];
    expect(m.status).toBe("completed"); expect(m.winnerId).toBe(m.teamA?.id);
    expect(m.setHistory).toHaveLength(2); expect(scoreLabel(m,"A")).toBe("2 [0]");
    expect(end.matches.find(m=>m.id==="r2-m1")?.teamA?.id).toBe(m.winnerId);
    for (const action of ["liveScore","start","end","completeSet"]) expect(()=>act(end,action,{gamesA:1,gamesB:0,setNumber:3})).toThrow();
  });
  it("rejects premature completion, excess sets, and legacy live-result bypass", () => {
    expect(()=>act(start(),"end")).toThrow(); expect(()=>act(set(start()),"end")).toThrow();
    const won = set(set(start())); expect(()=>games(won,1,0)).toThrow(/End/); expect(()=>set(won)).toThrow();
    expect(()=>act(start(),"score",{setsA:2,setsB:0})).toThrow(/live scoring/);
  });
  it("requires eligible opponents and rejects scoring a pending match or bye", () => {
    expect(()=>apply(demoTournament,{action:"start",matchId:"r2-m1"})).toThrow(/eligible/);
    expect(()=>games(demoTournament,1,0)).toThrow(/LIVE/);
    const s=structuredClone(demoTournament);s.matches[0].status="bye";expect(()=>act(s,"start")).toThrow();
  });
  it("supports best of five and advantage deciding sets", () => {
    let s=start();s.scoringConfig={bestOf:5,tiebreak:true,decidingSetTiebreak:false};
    s=set(set(set(set(s),0,6)),0,6);
    expect(()=>set(s,7,6)).toThrow(); s=set(s,8,6);
    const end=act(s,"end");expect(end.matches[0].setsA).toHaveLength(3);expect(end.matches[0].setsB).toHaveLength(2);expect(end.matches[0].setHistory).toHaveLength(5);
  });
  it("rejects corrupt final history and mismatched winner counts",()=>{
    const s=set(set(start()));s.matches[0].setHistory![0]={gamesA:6,gamesB:5};expect(()=>act(s,"end")).toThrow(/history/);
    const mismatch=set(set(start()));mismatch.matches[0].setHistory![0]={gamesA:0,gamesB:6};expect(()=>act(mismatch,"end")).toThrow(/history/);
  });
  it("advances the play-in winner with its full history",()=>{
    const id=demoTournament.playInMatch!.id; let s=apply(demoTournament,{action:"start",matchId:id});
    for(let i=1;i<=2;i++){s=apply(s,{action:"liveScore",matchId:id,gamesA:0,gamesB:6});s=apply(s,{action:"completeSet",matchId:id,setNumber:i});}
    s=apply(s,{action:"end",matchId:id});expect(s.playInMatch?.setHistory).toHaveLength(2);
    expect(s.matches.some(m=>m.round===1 && [m.teamA?.id,m.teamB?.id].includes(s.playInMatch?.winnerId))).toBe(true);
  });
});
