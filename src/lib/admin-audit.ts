import { createClient } from "@supabase/supabase-js";

export async function writeAdminAudit(login: string, action: string, details: Record<string, unknown> = {}) {
  // Read server configuration at runtime so isolated test servers can override it.
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) {
    console.error("ADMIN_AUDIT_NOT_PERSISTED: Supabase URL/service role key missing", { login, action, details });
    return false;
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.from("audit_events").insert({ action, before_state: null, after_state: { admin_login: login, ...details }, reason: `Admin activity: ${action}` });
  if (error) { console.error("ADMIN_AUDIT_WRITE_FAILED", error.message); return false; }
  return true;
}
