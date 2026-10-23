import { NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminSession } from "@/lib/admin-session";
import { writeAdminAudit } from "@/lib/admin-audit";
export async function POST() {
  const profile = await getAdminSession();
  if (profile) await writeAdminAudit(profile.login, "admin_logout");
  const response = NextResponse.redirect(new URL("/tournament-tennis-1337-admin", process.env.NEXT_PUBLIC_SITE_URL || "https://tennis-1337-med.vercel.app"), 303);
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
