import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-session";
import { writeAdminAudit } from "@/lib/admin-audit";

const schema = z.object({ login: z.string().min(1).max(80), name: z.string().trim().min(1).max(100), reason: z.string().trim().max(300).optional() });
export async function PATCH(request: Request) {
  const profile = await getAdminSession();
  if (!profile) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a login and a display name (maximum 100 characters)." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY on the server to enable protected player edits." }, { status: 503 });
  const adminDb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: player, error: findError } = await adminDb.from("players").select("id,name,external_key").eq("external_key", parsed.data.login).maybeSingle();
  if (findError) return NextResponse.json({ error: "Could not read player record." }, { status: 500 });
  if (!player) return NextResponse.json({ error: `Player '${parsed.data.login}' is not seeded in the database yet. Run the supplied seed SQL first.` }, { status: 404 });
  const { error: updateError } = await adminDb.from("players").update({ name: parsed.data.name }).eq("id", player.id);
  if (updateError) return NextResponse.json({ error: "Player name update failed." }, { status: 500 });
  const auditSaved = await writeAdminAudit(profile.login, "player_name_updated", { player_login: player.external_key, before_name: player.name, after_name: parsed.data.name, reason: parsed.data.reason || "Admin edited player display name" });
  if (!auditSaved) return NextResponse.json({ error: "Name changed, but audit logging failed. Check Supabase service-role configuration." }, { status: 500 });
  return NextResponse.json({ ok: true, login: player.external_key, name: parsed.data.name });
}
