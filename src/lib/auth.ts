import { getAdminSession } from "./admin-session";
export async function requireAdmin() {
  const profile = await getAdminSession();
  if (!profile) throw new Error("Administrator authentication required.");
  return { profile };
}
