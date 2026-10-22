import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "1337_tennis_admin";
export type AdminProfile = { login: string; displayName: string; role: "Administrator" };
const ADMINS = [
  { login: "nel-khal", env: "ADMIN_NEL_KHAL_PASSWORD", displayEnv: "ADMIN_NEL_KHAL_NAME", defaultName: "nel-khal" },
  { login: "amissa", env: "ADMIN_AMISSA_PASSWORD", displayEnv: "ADMIN_AMISSA_NAME", defaultName: "amissa" },
  { login: "bdebbagh", env: "ADMIN_BDEBBAGH_PASSWORD", displayEnv: "ADMIN_BDEBBAGH_NAME", defaultName: "bdebbagh" },
] as const;
function secret() { return process.env.ADMIN_SESSION_SECRET || ""; }
export function adminProfiles() { return ADMINS.map(a => ({ login: a.login, displayName: process.env[a.displayEnv] || a.defaultName, role: "Administrator" as const })); }
export function verifyAdminPassword(login: string, password: string): AdminProfile | null {
  const admin = ADMINS.find(a => a.login === login);
  const expected = admin ? process.env[admin.env] : undefined;
  if (!admin || !expected || !password || password.length > 1024) return null;
  const a = Buffer.from(expected); const b = Buffer.from(password);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { login: admin.login, displayName: process.env[admin.displayEnv] || admin.defaultName, role: "Administrator" };
}
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
export function createAdminToken(profile: AdminProfile) {
  if (secret().length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  const payload = Buffer.from(JSON.stringify({ ...profile, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function verifyAdminToken(token?: string): AdminProfile | null {
  if (!token || secret().length < 32) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload)); const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const allowed = adminProfiles().find(a => a.login === data.login);
    if (!allowed || data.exp < Date.now()) return null;
    return { ...allowed, displayName: allowed.displayName };
  } catch { return null; }
}
export async function getAdminSession() {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}
