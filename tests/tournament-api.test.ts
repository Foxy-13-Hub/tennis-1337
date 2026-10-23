import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoTournament } from "../src/lib/demo-data";
const mock = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), save: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/admin-session", () => ({ getAdminSession: mock.session }));
vi.mock("@/lib/admin-audit", () => ({ writeAdminAudit: mock.audit }));
vi.mock("@/lib/tournament-store", async importOriginal => ({ ...await importOriginal<object>(), getTournamentState: mock.load, saveTournamentState: mock.save }));
import { PATCH } from "../src/app/api/admin/tournament/route";
import { PATCH as rename } from "../src/app/api/admin/players/route";
import { TournamentConflictError } from "../src/lib/tournament-store";
const revision = "2026-10-23T10:00:00.000Z";
const request = (body: unknown) => new Request("http://localhost/api/admin/tournament", { method: "PATCH", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mock.session.mockResolvedValue({ login: "amissa" });
  mock.load.mockResolvedValue({ ...structuredClone(demoTournament), revision });
  mock.save.mockImplementation(async state => state);
  mock.audit.mockResolvedValue(true);
});
describe("protected tournament API", () => {
  it("rejects anonymous edits before accessing storage", async () => {
    mock.session.mockResolvedValue(null);
    expect((await PATCH(request({}))).status).toBe(403);
    expect(mock.load).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and missing revisions", async () => {
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: "{" }))).status).toBe(400);
    expect((await PATCH(request({ action: "score", matchId: "r1-m1", setsA: 2, setsB: 0 }))).status).toBe(400);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("rejects an outdated screen without writing", async () => {
    expect((await PATCH(request({ action: "score", matchId: "r1-m1", setsA: 2, setsB: 0, revision: "2026-10-22T00:00:00Z" }))).status).toBe(409);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("returns validation errors without writing", async () => {
    expect((await PATCH(request({ action: "score", matchId: "r2-m1", setsA: 2, setsB: 0, revision }))).status).toBe(400);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("returns the committed state and surfaces audit failures separately", async () => {
    mock.audit.mockResolvedValue(false);
    const response = await PATCH(request({ action: "score", matchId: "r1-m1", setsA: 0, setsB: 2, revision }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.auditSaved).toBe(false);
    expect(body.state.matches[0].winnerId).toBe(demoTournament.matches[0].teamB?.id);
    expect(body.state.status).toBe("in_progress");
  });
  it.each([[new TournamentConflictError("Changed"), 409], [new Error("Storage unavailable"), 503]])("handles save failure %s", async (error, status) => {
    mock.save.mockRejectedValueOnce(error);
    expect((await PATCH(request({ action: "score", matchId: "r1-m1", setsA: 2, setsB: 0, revision }))).status).toBe(status);
    expect(mock.audit).not.toHaveBeenCalled();
  });
  it("routes legacy player edits through the same state and revision protection", async () => {
    const response = await rename(request({ login: "amissa", name: "Updated", revision }));
    expect(response.status).toBe(200);
    expect(mock.save).toHaveBeenCalledOnce();
    expect((await response.json()).state.teams[0].players[0].name).toBe("Updated");
  });
});

describe("live operations through authenticated API",()=>{
 it.each(["start","liveScore","completeSet","end"])("rejects unauthorized %s before loading state",async action=>{
  mock.session.mockResolvedValue(null);expect((await PATCH(request({action,matchId:"r1-m1",revision,gamesA:1,gamesB:0,setNumber:1}))).status).toBe(403);expect(mock.save).not.toHaveBeenCalled();
 });
 it("returns the latest persisted state after multiple saves and completion",async()=>{
  let persisted={...structuredClone(demoTournament),revision};
  mock.load.mockImplementation(async()=>structuredClone(persisted));
  mock.save.mockImplementation(async state=>{persisted={...state,revision:new Date(Date.parse(persisted.revision)+1).toISOString()};return structuredClone(persisted);});
  async function send(action:string,extra={}){const response=await PATCH(request({action,matchId:"r1-m1",revision:persisted.revision,...extra}));expect(response.status).toBe(200);return (await response.json()).state;}
  await send("start");expect(persisted.matches[0]).toMatchObject({status:"live",gamesA:0,gamesB:0});
  for(const [gamesA,gamesB] of [[1,0],[2,1],[3,1]]){const result=await send("liveScore",{gamesA,gamesB});expect(result.matches[0]).toMatchObject({gamesA,gamesB});}
  for(let setNumber=1;setNumber<=2;setNumber++){await send("liveScore",{gamesA:6,gamesB:3});await send("completeSet",{setNumber});}
  await send("end");expect(persisted.matches[0].status).toBe("completed");
  expect((await PATCH(request({action:"liveScore",matchId:"r1-m1",gamesA:0,gamesB:0,revision:persisted.revision}))).status).toBe(400);
 });
 it("does not claim success after failed live persistence",async()=>{
  mock.save.mockRejectedValue(new Error("Storage unavailable"));
  const response=await PATCH(request({action:"start",matchId:"r1-m1",revision}));expect(response.status).toBe(503);expect((await response.json()).ok).toBeUndefined();expect(mock.audit).not.toHaveBeenCalled();
 });
});
