import { NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminSession } from "@/lib/admin-session";
import { writeAdminAudit } from "@/lib/admin-audit";
export async function POST() {
  const profile = await getAdminSession();
  if (profile) await writeAdminAudit(profile.login, "admin_logout");
  const response = new NextResponse(null, { status: 303, headers: { Location: "/tournament-tennis-1337-admin" } });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
