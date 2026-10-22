import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, createAdminToken, verifyAdminPassword } from "@/lib/admin-session";
import { writeAdminAudit } from "@/lib/admin-audit";

const schema = z.object({ login: z.string().min(1).max(80), password: z.string().min(1).max(1024) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your admin login and password." }, { status: 400 });
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) return NextResponse.json({ error: "Set a random ADMIN_SESSION_SECRET of at least 32 characters in .env.local." }, { status: 503 });
  const profile = verifyAdminPassword(parsed.data.login.trim(), parsed.data.password);
  if (!profile) {
    await writeAdminAudit(parsed.data.login.trim().slice(0, 80) || "unknown", "admin_login_failed");
    return NextResponse.json({ error: "Invalid admin login or password." }, { status: 401 });
  }
  const saved = await writeAdminAudit(profile.login, "admin_login_succeeded");
  const response = NextResponse.json({ ok: true, profile, auditSaved: saved });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(profile), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
