import { createClient } from "@supabase/supabase-js";
import { demoTournament } from "@/lib/demo-data";
import type { Tournament } from "@/lib/types";

const STATE_ID = "1337-tennis-open";
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function getTournamentState(): Promise<Tournament> {
  const client = db();
  if (!client) return demoTournament;
  const { data, error } = await client.from("tournament_state").select("state").eq("id", STATE_ID).maybeSingle();
  if (error) throw new Error(`Tournament state could not be loaded: ${error.message}`);
  if (data?.state) return data.state as Tournament;
  const { error: insertError } = await client.from("tournament_state").upsert({ id: STATE_ID, state: demoTournament, updated_at: new Date().toISOString() });
  if (insertError) throw new Error(`Tournament state could not be initialized: ${insertError.message}`);
  return demoTournament;
}
export async function saveTournamentState(state: Tournament) {
  const client = db();
  if (!client) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.");
  const { error } = await client.from("tournament_state").upsert({ id: STATE_ID, state, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Tournament state could not be saved: ${error.message}`);
}
