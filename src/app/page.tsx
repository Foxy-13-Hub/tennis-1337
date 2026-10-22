import { Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { getTournamentState } from "@/lib/tournament-store";
import type { Match, Team } from "@/lib/types";

function roundName(round: number, total: number) {
  if (round === total) return "FINAL";
  if (round === total - 1) return "SEMI-FINALS";
  if (round === total - 2) return "QUARTER-FINALS";
  if (round === 1) return "ROUND OF 16";
  return `ROUND ${round}`;
}
function teamSlot(team: Team | null, match: Match) {
  const won = !!team && match.winnerId === team.id;
  const setWins = team?.id === match.teamA?.id ? match.setsA.length : match.setsB.length;
  const isPlayInSlot = team?.id === "team-play-in-winner";
  return <div className={`bracket-team ${won ? "is-winner" : ""} ${!team ? "is-empty" : ""} ${isPlayInSlot ? "is-play-in-slot" : ""}`}>
    {team ? isPlayInSlot ? <div className="play-in-slot-copy"><span className="bracket-team-name">WINNER OF PLAY-IN</span><small>Slot 16</small></div> : <><div className="bracket-player-avatars"><Avatar name={team.players[0].name} image={team.players[0].image} size={26}/><Avatar name={team.players[1].name} image={team.players[1].image} size={26}/></div><div className="bracket-team-copy"><span className="bracket-team-name">{team.players[0].name}</span><span className="bracket-team-name">{team.players[1].name}</span></div><span className="bracket-score">{match.status === "completed" ? setWins : ""}</span></> : <span className="bracket-tbd">TBD</span>}
    {won && <span className="winner-mark">✓</span>}
  </div>;
}
function MatchCard({ match }: { match: Match }) {
  return <article className={`draw-match ${match.status === "completed" ? "match-complete" : ""}`}>
    <div className="draw-match-head"><span>#{String(match.position + 1).padStart(2, "0")}</span>{match.status === "completed" && <span className="match-state">FINAL</span>}</div>
    {teamSlot(match.teamA, match)}
    <div className="match-divider" />
    {teamSlot(match.teamB, match)}
    {(match.scheduledAt || match.court) && <div className="draw-match-meta">{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Time TBA"}{match.court ? ` · ${match.court}` : ""}</div>}
  </article>;
}
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const tournament = await getTournamentState();
  const all = tournament.matches;
  const totalRounds = Math.max(...all.map((m) => m.round));
  // Split each knockout round into left and right halves. For a 16-team draw,
  // that gives 4 first-round matches per side, then 2 quarterfinals, then 1 semifinal.
  const leftRounds = Array.from({ length: totalRounds - 1 }, (_, i) => {
    const roundNumber = i + 1;
    const roundMatches = all.filter((m) => m.round === roundNumber).sort((a, b) => a.position - b.position);
    return roundMatches.slice(0, Math.ceil(roundMatches.length / 2));
  });
  const rightRounds = Array.from({ length: totalRounds - 1 }, (_, i) => {
    const roundNumber = totalRounds - 1 - i;
    const roundMatches = all.filter((m) => m.round === roundNumber).sort((a, b) => a.position - b.position);
    return roundMatches.slice(Math.floor(roundMatches.length / 2)).reverse();
  });
  const finalMatch = all.find((m) => m.round === totalRounds);
  const roundTitles = Array.from({ length: totalRounds - 1 }, (_, i) => roundName(i + 1, totalRounds));
  return <main className="draw-page">
    <header className="draw-header"><div className="draw-brand"><span className="draw-brand-mark">1337</span><div><div className="draw-brand-title">OFFICIAL 1337 MED TOURNAMENT </div></div></div><div className="draw-header-right"><span className="live-dot"/> OFFICIAL TOURNAMENT BRACKET</div></header>
    <section className="draw-title"><div><div className="draw-kicker">1337 COMMUNITY OPEN</div><h1>Tournament <span>bracket</span></h1><p>17 teams · One play-in · 16-team knockout · Best of 3 sets.</p></div><div className="draw-title-stat"><Trophy size={19}/><div><strong>16 MAIN-DRAW SLOTS</strong><span>ONE CHAMPION</span></div></div></section>
    {tournament.playInMatch && <section className="play-in-section" aria-label="Preliminary match for slot 16"><div className="play-in-heading"><div><span className="draw-kicker">PRELIMINARY ROUND</span><h2>Play for the 16th slot</h2><p>Two randomly selected teams play first. The winner enters the main bracket.</p></div><div className="play-in-badge">MATCH 01 · PLAY-IN</div></div><div className="play-in-card"><div className="play-in-contender"><div className="bracket-player-avatars"><Avatar name={tournament.playInMatch.teamA!.players[0].name} image={tournament.playInMatch.teamA!.players[0].image} size={34}/><Avatar name={tournament.playInMatch.teamA!.players[1].name} image={tournament.playInMatch.teamA!.players[1].image} size={34}/></div><div><strong>{tournament.playInMatch.teamA!.players[0].name} / {tournament.playInMatch.teamA!.players[1].name}</strong><small>Team A</small></div></div><div className="play-in-versus">VS</div><div className="play-in-contender"><div className="bracket-player-avatars"><Avatar name={tournament.playInMatch.teamB!.players[0].name} image={tournament.playInMatch.teamB!.players[0].image} size={34}/><Avatar name={tournament.playInMatch.teamB!.players[1].name} image={tournament.playInMatch.teamB!.players[1].image} size={34}/></div><div><strong>{tournament.playInMatch.teamB!.players[0].name} / {tournament.playInMatch.teamB!.players[1].name}</strong><small>Team B</small></div></div><div className="play-in-slot-note"><Trophy size={17}/> {tournament.playInMatch.status === "completed" ? `FINAL · ${tournament.playInMatch.setsA.length}:${tournament.playInMatch.setsB.length}` : "WINNER TAKES SLOT 16"}</div>{(tournament.playInMatch.scheduledAt || tournament.playInMatch.court) && <div className="draw-match-meta">{tournament.playInMatch.scheduledAt ? new Date(tournament.playInMatch.scheduledAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Date TBA"}{tournament.playInMatch.court ? ` · ${tournament.playInMatch.court}` : ""}</div>}</div></section>}
    <section className="draw-board" aria-label="Tournament bracket">
      <div className="draw-half draw-left">{leftRounds.map((round, i) => <section className={`draw-round round-depth-${i + 1}`} key={`left-${i}`}><h2>{roundTitles[i]}</h2><div className="draw-round-stack">{round.map((match) => <MatchCard key={match.id} match={match}/>)}</div></section>)}</div>
      <section className="draw-final-column"><h2>CHAMPIONSHIP</h2><div className="draw-final-stage"><div className="final-orbit"><Trophy size={25}/></div>{finalMatch ? <MatchCard match={finalMatch}/> : <div className="draw-final-placeholder"><Trophy size={23}/><span>FINAL</span><small>Winners meet here</small></div>}<div className="champion-caption">THE ROAD TO THE TITLE</div></div></section>
      <div className="draw-half draw-right">{rightRounds.map((round, i) => <section className={`draw-round round-depth-${totalRounds - 1 - i}`} key={`right-${i}`}><h2>{roundTitles[totalRounds - 2 - i]}</h2><div className="draw-round-stack">{round.map((match) => <MatchCard key={match.id} match={match}/>)}</div></section>)}</div>
    </section>
    <footer className="draw-footer"><span><strong>1337 TENNIS CUP</strong> · TOURNAMENT BRACKET</span><span>PLAY FAIR. RALLY HARD.</span></footer>
  </main>;
}
