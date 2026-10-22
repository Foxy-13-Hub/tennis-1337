import { NextResponse } from "next/server";
import { getTournamentState } from "@/lib/tournament-store";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await getTournamentState(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load tournament." }, { status: 503 }); }
}
