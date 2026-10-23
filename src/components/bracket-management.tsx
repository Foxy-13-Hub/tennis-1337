"use client";
import { useEffect, useRef, useState } from "react";
import { allMatches, playInDestination } from "@/lib/bracket-edit";
import { scoreLabel } from "@/lib/live-score";
import type { Tournament } from "@/lib/types";

type Send = (key: string, body: Record<string, unknown>) => Promise<boolean>;
export function BracketManagement({ state, busy, send, message }: { state: Tournament; busy: boolean; send: Send; message: string }) {
  const [editing, setEditing] = useState<{ teamId: string } | { matchId: string } | null>(null);
  const rounds = [0, ...Array.from(new Set(state.matches.map(m => m.round))).sort((a,b)=>a-b)];
  const total = Math.max(...state.matches.map(m=>m.round));
  const final = state.matches.find(m=>!m.nextMatchId);
  const champion = [final?.teamA, final?.teamB].find(t=>t?.id===final?.winnerId);
  return <section id="bracket-management" className="bracket-management"><div className="section-kicker">Bracket Management</div><h2>Entire tournament</h2><p>Edit team rosters, swap draw positions, and review consequences before saving. Later rounds receive the winners of their feeder matches.</p>
    {champion && <p className="note">Champion: <strong>{champion.name}</strong></p>}
    <nav className="bracket-round-nav" aria-label="Tournament rounds">{rounds.map(r=><a key={r} href={`#admin-round-${r}`}>{roundLabel(r,total)}</a>)}</nav>
    <div className="admin-bracket-rounds">{rounds.map(round=><section id={`admin-round-${round}`} key={round}><h3>{roundLabel(round,total)}</h3>{allMatches(state).filter(m=>m.round===round).map(match=><article className="admin-bracket-match" key={match.id} data-admin-match={match.id}><strong>{match.id} · {match.status.toUpperCase()}</strong>{(["A","B"] as const).map(slot=>{const team=slot==="A"?match.teamA:match.teamB;return <div className="admin-team-slot" key={slot}><div><strong>{team?.name ?? "Awaiting feeder winner"}{team?.id===match.winnerId?" · Winner":""}</strong><div>{team?.players.map(p=>p.name).join(" / ")}</div><small>Team {slot} · {scoreLabel(match,slot)}</small></div>{team && state.teams.some(t=>t.id===team.id)&&<button className="secondary-btn" disabled={busy} onClick={()=>setEditing({teamId:team.id})}>Edit Team</button>}</div>})}<small>{match.nextMatchId?`Winner → ${match.nextMatchId}, slot ${match.nextSlot}`:round===0?"Winner → main draw slot 16":"Winner → tournament champion"}</small><button className="secondary-btn" disabled={busy} onClick={()=>setEditing({matchId:match.id})}>Edit Match Slots</button></article>)}</section>)}</div>
    <details><summary>All teams</summary><div className="team-editor-list">{state.teams.map(t=><button className="secondary-btn" disabled={busy} key={t.id} onClick={()=>setEditing({teamId:t.id})}>{t.name} · Edit Team</button>)}</div></details>
    {editing&&<BracketEditor state={state} editing={editing} busy={busy} send={send} message={message} close={()=>setEditing(null)}/>}
  </section>;
}
function roundLabel(round:number,total:number){return round===0?"Preliminary play-in":round===total?"Final":round===total-1?"Semi-finals":round===total-2?"Quarter-finals":"Round of 16";}
function BracketEditor({state,editing,busy,send,close,message}:{message:string;state:Tournament;editing:{teamId:string}|{matchId:string};busy:boolean;send:Send;close:()=>void}){
  const team="teamId" in editing?state.teams.find(t=>t.id===editing.teamId):undefined;
  const match="matchId" in editing?allMatches(state).find(m=>m.id===editing.matchId):undefined;
  const [name,setName]=useState(team?.name??"");
  const [first,setFirst]=useState(team?.players[0].id??match?.teamA?.id??"");
  const [second,setSecond]=useState(team?.players[1].id??match?.teamB?.id??"");
  const [swaps,setSwaps]=useState(false),[search,setSearch]=useState("");
  const dialog=useRef<HTMLDialogElement>(null);
  const dirty=name!==(team?.name??"")||first!==(team?.players[0].id??match?.teamA?.id??"")||second!==(team?.players[1].id??match?.teamB?.id??"");
  useEffect(()=>{dialog.current?.showModal();},[]);
  useEffect(()=>{
    const unload=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",unload);
    return()=>window.removeEventListener("beforeunload",unload);
  },[dirty]);
  function cancel(){if(!busy&&(!dirty||window.confirm("Discard unsaved changes?")))close();}
  const destination=playInDestination(state);
  const players=state.teams.flatMap(t=>t.players);
  const locked=(slot:"A"|"B")=>!!match&&(match.round>1||(destination?.match.id===match.id&&destination.slot===slot));
  const options=(value:string)=>team?players.filter(p=>p.id===value||`${p.name} ${p.login}`.toLowerCase().includes(search.toLowerCase())).map(p=><option key={p.id} value={p.id}>{p.name} ({p.login}) · {state.teams.find(t=>t.players.some(member=>member.id===p.id))?.name}</option>):state.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>);
  async function save(){const body=team?{action:"editTeam",teamId:team.id,name,playerIds:[first,second],swapConflicts:swaps}:{action:"editSlots",matchId:match!.id,teamA:first,teamB:second,swapConflicts:swaps};if(await send("bracket-edit",body))close();}
  return <dialog ref={dialog} className="bracket-edit-dialog" aria-labelledby="bracket-edit-title" onCancel={e=>{e.preventDefault();cancel();}}><form onSubmit={e=>{e.preventDefault();void save();}}><h2 id="bracket-edit-title">{team?"Edit Team":"Edit Match Slots"}</h2><p>{team?`Current players: ${team.players.map(p=>`${p.name} (${p.login})`).join(" / ")}`:`${match!.id}: ${match!.teamA?.name??"TBD"} vs ${match!.teamB?.name??"TBD"}`}</p>
    {team&&<><label className="field">Team name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label className="field">Search players<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or login"/></label></>}
    {(["A","B"] as const).map((slot,i)=>{const value=i===0?first:second;return <label className="field" key={slot}>{team?`Player ${i+1}`:`Team ${slot}`}<select aria-label={team?`Player ${i+1}`:`Team ${slot}`} value={value} disabled={busy||(!team&&locked(slot))} onChange={e=>(i===0?setFirst:setSecond)(e.target.value)}><option value="">Awaiting feeder winner</option>{!team&&value==="team-play-in-winner"&&<option value={value}>Winner of play-in</option>}{options(value)}</select></label>})}
    {!team&&<p>Slot 16 follows the play-in result. Later-round slots follow feeder results; use Match management below to correct those results.</p>}
    <label className="swap-control"><input type="checkbox" checked={swaps} onChange={e=>setSwaps(e.target.checked)}/>Allow swaps with existing assignments</label><p>Players and teams already assigned elsewhere must be swapped with the displaced players or teams. The preview lists every changed assignment and affected result.</p>
    {first===second&&<p role="alert">Choose two different {team?"players":"teams"}.</p>}
    {message&&<p role="status">{message}</p>}
    <div className="editor-actions"><button className="primary-btn" disabled={busy||!dirty||!first||!second||first===second||!!team&&!name.trim()}>{busy?"Saving…":"Save Changes"}</button><button type="button" className="secondary-btn" disabled={busy} onClick={cancel}>Cancel</button></div></form></dialog>;
}
