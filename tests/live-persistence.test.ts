import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTournamentState, saveTournamentState } from "../src/lib/tournament-store";
import { applyTournamentAction as apply } from "../src/lib/tournament-actions";
// Node fixture is shared with the standalone browser script.
import { startTestStorage } from "../scripts/live-test-storage.mjs";
let storage: Awaited<ReturnType<typeof startTestStorage>>;
beforeAll(async()=>{storage=await startTestStorage();vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",storage.url);vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","isolated-test-only");});
afterAll(async()=>{vi.unstubAllEnvs();await storage?.close();});
describe("real Supabase SDK over isolated PostgREST storage",()=>{
 it("persists every save, handles concurrency/failure and atomically advances",async()=>{
  let s=await getTournamentState();const matchId=s.matches[0].id;
  const mutate=async(action:string,extra={})=>{s=await saveTournamentState(apply(s,{action,matchId,...extra}));};
  await mutate("start");expect((await getTournamentState()).matches[0]).toMatchObject({status:"live",gamesA:0,gamesB:0});
  for(const [gamesA,gamesB] of [[1,0],[2,1],[3,1]]){await mutate("liveScore",{gamesA,gamesB});expect((await getTournamentState()).matches[0]).toMatchObject({gamesA,gamesB,setsA:[],setsB:[]});}
  const stale=structuredClone(s);await mutate("liveScore",{gamesA:4,gamesB:1});
  await expect(saveTournamentState(apply(stale,{action:"liveScore",matchId,gamesA:0,gamesB:0}))).rejects.toThrow(/changed/);
  storage.failWrite();await expect(mutate("liveScore",{gamesA:5,gamesB:1})).rejects.toThrow(/could not be saved/);
  expect((await getTournamentState()).matches[0].gamesA).toBe(4);
  const racing=await Promise.allSettled([saveTournamentState(apply(s,{action:"liveScore",matchId,gamesA:5,gamesB:1})),saveTournamentState(apply(s,{action:"liveScore",matchId,gamesA:5,gamesB:2}))]);
  expect(racing.filter(r=>r.status==="fulfilled")).toHaveLength(1);s=await getTournamentState();
  await expect(mutate("end")).rejects.toThrow(/valid sets/);
  expect((await getTournamentState()).matches.find(m=>m.id==="r2-m1")?.teamA).toBeNull();
  for(let setNumber=1;setNumber<=2;setNumber++){await mutate("liveScore",{gamesA:6,gamesB:3});await mutate("completeSet",{setNumber});}
  const beforeEnd=await getTournamentState();expect(beforeEnd.matches[0].status).toBe("live");
  storage.failWrite();await expect(mutate("end")).rejects.toThrow(/saved/);expect((await getTournamentState()).matches.find(m=>m.id==="r2-m1")?.teamA).toBeNull();
  await mutate("end");const end=await getTournamentState();expect(end.matches[0]).toMatchObject({status:"completed",gamesA:0,gamesB:0,setHistory:[{gamesA:6,gamesB:3},{gamesA:6,gamesB:3}]});
  expect(end.matches.find(m=>m.id==="r2-m1")?.teamA?.id).toBe(end.matches[0].winnerId);
 });
});
