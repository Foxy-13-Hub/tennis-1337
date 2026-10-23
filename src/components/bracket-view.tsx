import { scoreLabel, setHistoryLabel } from "@/lib/live-score";
import type { Match } from "@/lib/types";
function roundName(round: number, total: number) {
  if (round === total) return "Final";
  if (round === total - 1) return "Semifinals";
  if (round === total - 2) return "Quarterfinals";
  return `Round ${round}`;
}
export function BracketView({ matches }: { matches: Match[] }) {
  const total = Math.max(1, ...matches.map(m => m.round));
  const rounds = Array.from({length:total},(_,i)=>matches.filter(m=>m.round===i+1).sort((a,b)=>a.position-b.position));
  return <div className="bracket-wrap"><div className="bracket">
    {rounds.map((round, i)=><section className="round" key={i}><h3>{roundName(i+1,total)}</h3><div className="round-matches">
      {round.map(match=><article className="bracket-match" key={match.id}>
        {match.status === "live" && <span className="live-badge">● LIVE</span>}<div className={`slot ${match.winnerId===match.teamA?.id?"winner":""}`}><span>{match.teamA?.name ?? (match.status==="bye"?"BYE":"TBD")}</span>{["live","completed"].includes(match.status)&&<span className="slot-score">{scoreLabel(match,"A")}</span>}</div>
        <div className={`slot ${match.winnerId===match.teamB?.id?"winner":""}`}><span>{match.teamB?.name ?? (match.status==="bye"?"BYE":"TBD")}</span>{["live","completed"].includes(match.status)&&<span className="slot-score">{scoreLabel(match,"B")}</span>}</div>
        <small>{setHistoryLabel(match)}</small><div className="round-note">{match.court || "Court TBA"} · {match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}) : "Date TBA"}</div>
      </article>)}
    </div></section>)}
  </div></div>;
}
