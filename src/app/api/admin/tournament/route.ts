import { BracketEditError, resultImpacts } from "@/lib/bracket-edit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-session";
import { getTournamentState, saveTournamentState, TournamentConflictError } from "@/lib/tournament-store";
import { applyTournamentAction, TournamentInputError, updateSchema } from "@/lib/tournament-actions";
import { writeAdminAudit } from "@/lib/admin-audit";

export async function PATCH(request: Request) {
  const profile = await getAdminSession();
  if (!profile) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  const revision = z.string().datetime({ offset: true }).safeParse(body?.revision);
  if (!parsed.success || !revision.success) return NextResponse.json({ error: "Invalid tournament update. Reload before saving." }, { status: 400 });
  try {
    const current = await getTournamentState();
    if (current.revision !== revision.data) throw new TournamentConflictError("The tournament changed. Reload it before submitting your edit again.");
    const proposed = applyTournamentAction(current, parsed.data);
    const impacts = resultImpacts(current, proposed).filter(label =>
      !(["start", "liveScore", "completeSet", "end"].includes(parsed.data.action) && "matchId" in parsed.data && label.startsWith(`${parsed.data.matchId}:`)));
    if (body.preview === true) return NextResponse.json({ preview: true, impacts, state: proposed });
    if (impacts.length && body.confirmDestructive !== true) return NextResponse.json({ error: "Confirmation required before changing saved match results.", impacts }, { status: 422 });
    const state = await saveTournamentState(proposed);
    const auditSaved = await writeAdminAudit(profile.login, `tournament_${parsed.data.action}`, { action: parsed.data });
    return NextResponse.json({ ok: true, state, auditSaved });
  } catch (error) {
    const status = error instanceof TournamentConflictError ? 409 : (error instanceof TournamentInputError || error instanceof BracketEditError) ? 400 : 503;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tournament update failed." }, { status });
  }
}
