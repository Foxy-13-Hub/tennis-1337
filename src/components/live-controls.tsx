"use client";
import { useState } from "react";
import type { Match } from "@/lib/types";
import { changeGames, scoreLabel, setHistoryLabel } from "@/lib/live-score";
export function LiveControls({ match, busy, send }: { match: Match; busy: boolean; send: (body: Record<string, unknown>) => void }) {
  const [a, setA] = useState(match.gamesA ?? 0);
  const [b, setB] = useState(match.gamesB ?? 0);
  const dirty = a !== (match.gamesA ?? 0) || b !== (match.gamesB ?? 0);
  const action = (action: string, extra = {}) => send({ action, matchId: match.id, ...extra });
  const eligible = !!match.teamA && !!match.teamB && ![match.teamA.id, match.teamB.id].includes("team-play-in-winner");
  return <section className="live-controls" aria-label="Live match controls">
    <strong>Match status: {match.status.toUpperCase()}</strong>
    {(match.status === "upcoming" || match.status === "postponed") && <button className="primary-btn" disabled={busy || !eligible} onClick={() => action("start")}>Start Match</button>}
    {(match.status === "live" || match.status === "completed") && <>
      <div className="live-score-grid">{(["A", "B"] as const).map(side => {
        const value = side === "A" ? a : b;
        const change = side === "A" ? setA : setB;
        return <div key={side}><strong>{(side === "A" ? match.teamA : match.teamB)?.name}</strong><div>Saved: {scoreLabel(match, side)}</div>
          {match.status === "live" && <><div>Sets: {(side === "A" ? match.setsA : match.setsB).length} · Current-set games</div><div className="game-stepper"><button className="secondary-btn" aria-label={`Decrease Team ${side} games`} disabled={busy || value === 0} onClick={() => change(current => changeGames(current, -1))}>−</button><output aria-label={`Team ${side} games`}>{value}</output><button className="secondary-btn" aria-label={`Increase Team ${side} games`} disabled={busy || value === 100} onClick={() => change(current => changeGames(current, 1))}>+</button></div></>}
        </div>;
      })}</div>
      {match.setHistory?.length ? <div>Completed sets: {setHistoryLabel(match)}</div> : null}
    </>}
    {match.status === "live" && <><small role="status">{dirty ? "Unsaved changes — public score is unchanged." : "Showing saved score."}</small><div className="live-actions">
      <button className="primary-btn" disabled={busy || !dirty} onClick={() => action("liveScore", { gamesA: a, gamesB: b })}>{busy ? "Saving…" : "Save Score"}</button>
      <button className="secondary-btn" disabled={busy || dirty} onClick={() => { if (window.confirm("Record this saved game score as a completed set and reset games to zero?")) action("completeSet", { setNumber: (match.setHistory?.length ?? 0) + 1 }); }}>Complete Set</button>
      <button className="secondary-btn" disabled={busy || dirty} onClick={() => { if (window.confirm("End this match and advance its winner?")) action("end"); }}>End Match</button>
    </div><small>Save games before completing a set. Sets never change automatically.</small></>}
  </section>;
}
