import { scoreLabel, setHistoryLabel } from "@/lib/live-score";
import type { Match, Team } from "@/lib/types";
import { TeamAvatars } from "./team-avatars";

function TeamRow({ team, score, winner }: { team: Team | null; score?: string; winner?: boolean }) {
  if (!team) return <div className="match-team"><div className="team-avatar-pair"><span className="avatar"/></div><div><div className="match-team-name" style={{color:"#8a938c"}}>To be determined</div><div className="match-team-sub">Awaiting previous round</div></div></div>;
  return <div className="match-team">
    <TeamAvatars team={team}/>
    <div style={{minWidth:0}}><span className="match-team-name">{team.name}</span><div className="match-team-sub">{team.players.map(p=>p.name).join(" · ")}</div></div>
    {score !== undefined && <span className="score" style={{color:winner?"#167346":"#18231b"}}>{score}</span>}
  </div>;
}
export function MatchCard({ match }: { match: Match }) {
  const aScore = scoreLabel(match, "A");
  const bScore = scoreLabel(match, "B");
  const winnerA = !!match.winnerId && match.winnerId === match.teamA?.id;
  const winnerB = !!match.winnerId && match.winnerId === match.teamB?.id;
  const statusLabel = match.status === "completed" ? "Completed" : match.status === "live" ? "● LIVE" : match.status === "bye" ? "Bye" : match.status === "postponed" ? "Postponed" : "Upcoming";
  return <article className="match-card">
    <div className="match-top"><span>Round {match.round}</span><span className={match.status === "live" ? "live-badge" : "badge"}>{statusLabel}</span></div>
    <TeamRow team={match.teamA} score={["live", "completed"].includes(match.status) ? aScore : undefined} winner={winnerA}/>
    <TeamRow team={match.teamB} score={["live", "completed"].includes(match.status) ? bScore : undefined} winner={winnerB}/>
    <div>{setHistoryLabel(match)}</div><div className="match-foot"><span>◷ {match.scheduledAt ? new Date(match.scheduledAt).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "Time TBA"}</span><span>⌑ {match.court || "Court TBA"}</span></div>
  </article>;
}
