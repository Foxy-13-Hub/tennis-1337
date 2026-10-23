import { createClient } from "@supabase/supabase-js";
import { configurePlayInRoster } from "./play-in-roster";
import { demoTournament } from "./demo-data";
import type { Tournament } from "./types";

const STATE_ID = "1337-tennis-open";
export class TournamentConflictError extends Error {}
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function getTournamentState(attempt = 0): Promise<Tournament> {
  const client = db();
  if (!client) return structuredClone(demoTournament);
  const load = () => client.from("tournament_state").select("state,updated_at").eq("id", STATE_ID).maybeSingle();
  let { data, error } = await load();
  if (error) throw new Error("Tournament state could not be loaded.");
  if (!data) {
    // A competing worker may already have created or edited the row.
    const { error: insertError } = await client.from("tournament_state").upsert({ id: STATE_ID, state: demoTournament }, { onConflict: "id", ignoreDuplicates: true });
    if (insertError) throw new Error("Tournament state could not be initialized.");
    ({ data, error } = await load());
  }
  if (error || !data?.state) throw new Error("Tournament state could not be loaded.");
  const stored = { ...data.state as Tournament, revision: data.updated_at };
  const configured = configurePlayInRoster(stored);
  if (configured === stored) return stored;
  try { return await saveTournamentState(configured); }
  catch (error) {
    // A scoring request may win the race. Reload and recheck the unstarted
    // roster guard; never overwrite that administrator's persisted result.
    if (error instanceof TournamentConflictError && attempt < 2) return getTournamentState(attempt + 1);
    throw error;
  }
}
export async function saveTournamentState(state: Tournament): Promise<Tournament> {
  const client = db();
  if (!client) throw new Error("Persistent tournament storage is not configured.");
  if (!state.revision) throw new TournamentConflictError("Reload the tournament before saving.");
  const { revision, ...stored } = state;
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(revision) + 1)).toISOString();
  const { data, error } = await client.from("tournament_state").update({ state: stored, updated_at: updatedAt }).eq("id", STATE_ID).eq("updated_at", revision).select("updated_at").maybeSingle();
  if (error) throw new Error("Tournament state could not be saved.");
  if (!data) throw new TournamentConflictError("The tournament changed. Reload it before submitting your edit again.");
  return { ...stored, revision: data.updated_at };
}
