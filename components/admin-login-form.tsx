"use client";

import { FormEvent, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase configuration is missing");
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="text-lg font-semibold">Administrator Sign In</h2>
      <label className="block text-sm">
        <span>Email</span>
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded border border-white/20 bg-black px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span>Password</span>
        <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded border border-white/20 bg-black px-3 py-2" />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button disabled={loading} className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60" type="submit">
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
