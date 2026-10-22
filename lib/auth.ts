import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const fallbackAllowlist = new Set(
  (process.env.ADMIN_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

export type AdminActor = {
  userId: string;
  email: string;
  role: string;
};

export async function getAdminActor(): Promise<AdminActor | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  const normalizedEmail = user.email.toLowerCase();

  const { data: admin } = await supabase
    .from("administrators")
    .select("role, is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const allowlisted = fallbackAllowlist.has(normalizedEmail);

  if (!admin && !allowlisted) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    role: admin?.role ?? "owner",
  };
}

export async function requireAdmin(): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (!actor) {
    redirect("/tournament-tennis-1337-admin?error=auth_required");
  }
  return actor;
}
