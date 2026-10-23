"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// No overlapping reads: events and timers share one in-flight request. RSC refresh
// reads persisted state; local admin drafts are never broadcast to public pages.
export function PublicSync({ revision }: { revision?: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;
    let latest = revision;
    let lastRefreshAt = 0;
    const controller = new AbortController();
    async function check() {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const response = await fetch("/api/tournament", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error("Unavailable");
        const state = await response.json();
        if (stopped) return;
        setFailed(false);
        if (state.revision && (!latest || Date.parse(state.revision) > Date.parse(latest))) {
          latest = state.revision;
        }
        // Compare against the rendered revision until refresh succeeds. A failed
        // RSC request must not permanently mark an unseen score as displayed.
        if (latest && (!revision || Date.parse(latest) > Date.parse(revision)) && Date.now() - lastRefreshAt >= 5000) {
          lastRefreshAt = Date.now();
          router.refresh();
        }
      } catch { if (!stopped) setFailed(true); }
      finally { inFlight = false; }
    }
    async function poll() { await check(); if (!stopped) timer = setTimeout(poll, 2000); }
    const resume = () => { void check(); };
    void poll();
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    return () => { stopped = true; clearTimeout(timer); controller.abort(); window.removeEventListener("online", resume); window.removeEventListener("focus", resume); };
  }, [revision, router]);
  return failed ? <p className="sync-warning" role="status">Live updates temporarily unavailable. Retrying automatically; showing the last saved result.</p> : null;
}
