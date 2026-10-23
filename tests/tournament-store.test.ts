import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoTournament } from "../src/lib/demo-data";
const mock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mock.createClient }));
import { getTournamentState, saveTournamentState, TournamentConflictError } from "../src/lib/tournament-store";
const revision = "2026-10-23T10:00:00.000Z";
function client(results: unknown[]) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => results.shift()),
    upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnThis(),
  };
  mock.createClient.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  vi.clearAllMocks();
});
describe("durable state", () => {
  it("returns isolated deterministic previews without storage", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const state = await getTournamentState(); state.matches[0].court = "Changed";
    expect((await getTournamentState()).matches[0].court).toBeUndefined();
    await expect(saveTournamentState(state)).rejects.toThrow(/not configured/);
  });
  it("reloads the same stored state with its revision", async () => {
    client([{ data: { state: demoTournament, updated_at: revision }, error: null }]);
    expect(await getTournamentState()).toEqual({ ...demoTournament, revision });
  });
  it("initializes without overwriting another worker's draw and re-reads the winner", async () => {
    const other = { ...demoTournament, name: "Saved by another worker" };
    const query = client([{ data: null, error: null }, { data: { state: other, updated_at: revision }, error: null }]);
    expect((await getTournamentState()).name).toBe(other.name);
    expect(query.upsert).toHaveBeenCalledWith({ id: "1337-tennis-open", state: demoTournament }, { onConflict: "id", ignoreDuplicates: true });
  });
  it("saves only the revision read and returns the committed revision", async () => {
    const nextRevision = "2026-10-23T11:00:00.000Z";
    const query = client([{ data: { updated_at: nextRevision }, error: null }]);
    expect((await saveTournamentState({ ...demoTournament, revision })).revision).toBe(nextRevision);
    expect(query.eq).toHaveBeenCalledWith("updated_at", revision);
    expect(query.update.mock.calls[0][0].state.revision).toBeUndefined();
  });
  it("rejects concurrent overwrites", async () => {
    client([{ data: null, error: null }]);
    await expect(saveTournamentState({ ...demoTournament, revision })).rejects.toBeInstanceOf(TournamentConflictError);
  });
  it("rejects unversioned writes", async () => {
    client([]);
    await expect(saveTournamentState(demoTournament)).rejects.toBeInstanceOf(TournamentConflictError);
  });
  it("reports storage failures without claiming success or exposing database messages", async () => {
    client([{ data: null, error: { message: "private database details" } }]);
    await expect(getTournamentState()).rejects.toThrow("Tournament state could not be loaded.");
    client([{ data: null, error: { message: "private database details" } }]);
    await expect(saveTournamentState({ ...demoTournament, revision })).rejects.toThrow("Tournament state could not be saved.");
  });
});
