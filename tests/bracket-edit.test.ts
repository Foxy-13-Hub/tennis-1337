import { describe, expect, it } from "vitest";
import { demoTournament } from "../src/lib/demo-data";
import { applyTournamentAction } from "../src/lib/tournament-actions";
import { allMatches, applyBracketEdit, playInDestination, resultImpacts } from "../src/lib/bracket-edit";
import { configurePlayInRoster } from "../src/lib/play-in-roster";
import type { Tournament } from "../src/lib/types";
const score=(state:Tournament,id:string)=>applyTournamentAction(state,{action:"score",matchId:id,setsA:2,setsB:0});
const edit=(state:Tournament,ids:string[],swapConflicts=true)=>applyBracketEdit(state,{action:"editTeam",teamId:state.teams[0].id,name:"Edited team",playerIds:ids,swapConflicts});
describe("bracket roster and positions",()=>{
 it("contains the play-in and every knockout round",()=>{expect(allMatches(demoTournament)).toHaveLength(16);expect(new Set(allMatches(demoTournament).map(m=>m.round))).toEqual(new Set([0,1,2,3,4]));});
 it.each([1,2])("replaces %i members via explicit swaps and preserves all local identities",count=>{
  const s=demoTournament,ids=[s.teams[1].players[0].id,count===2?s.teams[2].players[1].id:s.teams[0].players[1].id];
  const changed=edit(s,ids);
  expect(changed.teams[0].players.map(p=>p.id)).toEqual(ids);
  expect(changed.teams.flatMap(t=>t.players).sort((a,b)=>a.id.localeCompare(b.id))).toEqual(s.teams.flatMap(t=>t.players).sort((a,b)=>a.id.localeCompare(b.id)));
  expect(configurePlayInRoster(changed)).toBe(changed);
  for(const m of allMatches(changed))for(const t of [m.teamA,m.teamB])if(t?.id===s.teams[0].id)expect(t).toEqual(changed.teams[0]);
 });
 it("rejects duplicate players, foreign players, and unconfirmed assignment conflicts",()=>{
  const id=demoTournament.teams[0].players[0].id;
  expect(()=>edit(demoTournament,[id,id])).toThrow(/different/);
  expect(()=>edit(demoTournament,[id,"foreign"])).toThrow(/local/);
  expect(()=>edit(demoTournament,[id,demoTournament.teams[1].players[0].id],false)).toThrow(/assigned/);
 });
 it("swaps occupied draw slots without duplicate assignments",()=>{
  const s=demoTournament,a=s.matches[0],b=s.matches[1];
  const action={action:"editSlots",matchId:a.id,teamA:b.teamA!.id,teamB:a.teamB!.id,swapConflicts:true};
  expect(()=>applyBracketEdit(s,{...action,swapConflicts:false})).toThrow(/already occupies/);
  const changed=applyBracketEdit(s,action);
  expect(changed.matches[0].teamA?.id).toBe(b.teamA!.id);expect(changed.matches[1].teamA?.id).toBe(a.teamA!.id);
  const roots=allMatches(changed).filter(m=>m.round<=1).flatMap(m=>[m.teamA?.id,m.teamB?.id]);expect(new Set(roots).size).toBe(roots.length);
 });
 it("advances the play-in winner into slot 16 and refuses a manual override",()=>{
  const s=score(demoTournament,demoTournament.playInMatch!.id),d=playInDestination(s)!;
  expect(d.match[d.slot==="A"?"teamA":"teamB"]?.id).toBe(s.playInMatch?.winnerId);
  expect(()=>applyBracketEdit(s,{action:"editSlots",matchId:d.match.id,teamA:s.teams[0].id,teamB:s.teams[1].id,swapConflicts:true})).toThrow();
 });
 it("detects downstream results, clears champion, and preserves independent completed branches",()=>{
  let s=score(demoTournament,demoTournament.playInMatch!.id);
  for(const m of s.matches)s=score(s,m.id);
  expect(s.status).toBe("completed");
  const first=s.matches[0],other=s.matches.find(m=>m.round===1&&m.id!==first.id&&m.teamA?.id!==s.teams[0].id&&m.teamB?.id!==s.teams[0].id)!;
  const team=first.teamA!,donor=first.teamB!;
  const changed=applyBracketEdit(s,{action:"editTeam",teamId:team.id,name:team.name,playerIds:[donor.players[0].id,team.players[1].id],swapConflicts:true});
  expect(resultImpacts(s,changed).length).toBeGreaterThanOrEqual(4);
  expect(changed.matches.find(m=>m.id===other.id)).toEqual(other);
  expect(changed.matches.find(m=>m.round===4)?.winnerId).toBeUndefined();expect(changed.status).not.toBe("completed");
  for(const m of changed.matches)if(m.nextMatchId){const next=changed.matches.find(n=>n.id===m.nextMatchId)!;expect(next[m.nextSlot==="A"?"teamA":"teamB"]?.id).toBe(m.winnerId);}
 });
 it("preserves results when only the team name changes",()=>{
  const s=score(demoTournament,"r1-m1"),team=s.teams[0];const changed=edit(s,team.players.map(p=>p.id));expect(resultImpacts(s,changed)).toEqual([]);
 });
 it("rejects direct edits to derived slots and invalid teams",()=>{
  expect(()=>applyBracketEdit(demoTournament,{action:"editSlots",matchId:"r2-m1",teamA:"team-1",teamB:"team-2",swapConflicts:true})).toThrow(/feeder/);
  expect(()=>applyBracketEdit(demoTournament,{action:"editSlots",matchId:"r1-m1",teamA:"foreign",teamB:"team-2",swapConflicts:true})).toThrow(/eligible/);
 });
});
