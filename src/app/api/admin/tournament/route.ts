import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-session";
import { getTournamentState, saveTournamentState } from "@/lib/tournament-store";
import { writeAdminAudit } from "@/lib/admin-audit";
import type { Match, Team, Tournament } from "@/lib/types";
const schema = z.discriminatedUnion("action", [
 z.object({ action:z.literal("schedule"),matchId:z.string().min(1),scheduledAt:z.string().max(40).nullable(),court:z.string().max(80).nullable() }),
 z.object({ action:z.literal("rename"),login:z.string().min(1).max(80),name:z.string().trim().min(1).max(100) }),
 z.object({ action:z.literal("score"),matchId:z.string().min(1),setsA:z.number().int().min(0).max(2),setsB:z.number().int().min(0).max(2) }),
]);
function clearDownstream(state:Tournament,match:Match){let current:Match|undefined=match;while(current?.nextMatchId){const next=state.matches.find(m=>m.id===current!.nextMatchId);if(!next)break;if(current.nextSlot==="A")next.teamA=null;else if(current.nextSlot==="B")next.teamB=null;next.winnerId=undefined;next.setsA=[];next.setsB=[];next.status="upcoming";current=next;}}
export async function PATCH(request:Request){
 const profile=await getAdminSession();if(!profile)return NextResponse.json({error:"Administrator access required."},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid tournament update."},{status:400});
 try{
  const state=await getTournamentState();const action=parsed.data;
  if(action.action==="rename"){
   let found=false;state.teams.forEach((team:Team)=>team.players.forEach(player=>{if((player.login||player.name).toLowerCase()===action.login.toLowerCase()){player.name=action.name;found=true;}}));
   const renameMatch=(match:Match|undefined)=>match&&[match.teamA,match.teamB].forEach(team=>team?.players.forEach(player=>{if((player.login||player.name).toLowerCase()===action.login.toLowerCase())player.name=action.name;}));state.matches.forEach(renameMatch);renameMatch(state.playInMatch);
   if(!found)return NextResponse.json({error:`Player '${action.login}' was not found.`},{status:404});await saveTournamentState(state);await writeAdminAudit(profile.login,"player_name_updated",{login:action.login,name:action.name});return NextResponse.json({ok:true,state});
  }
  const match=state.matches.find(m=>m.id===action.matchId)||(state.playInMatch?.id===action.matchId?state.playInMatch:undefined);if(!match)return NextResponse.json({error:"Match not found."},{status:404});
  if(action.action==="schedule"){match.scheduledAt=action.scheduledAt||undefined;match.court=action.court?.trim()||undefined;}
  else{
   clearDownstream(state,match);
   if(match.id==="play-in-m1"&&state.playInMatch){
    const playInIds=new Set([state.playInMatch.teamA?.id,state.playInMatch.teamB?.id]);
    const slot=state.matches.find(m=>playInIds.has(m.teamA?.id)||playInIds.has(m.teamB?.id));
    if(slot){const placeholder:Team={id:"team-play-in-winner",name:"Winner of play-in",players:[{id:"play-in-winner-a",name:"Play-in winner",image:"/players/default.svg"},{id:"play-in-winner-b",name:"Play-in winner",image:"/players/default.svg"}]};if(playInIds.has(slot.teamA?.id))slot.teamA=placeholder;else slot.teamB=placeholder;}
   }
   if(action.setsA===0&&action.setsB===0){match.setsA=[];match.setsB=[];match.winnerId=undefined;match.status="upcoming";}
   else {
    if(action.setsA===action.setsB||Math.max(action.setsA,action.setsB)!==2)return NextResponse.json({error:"Enter a valid best-of-three sets result, such as 2–1 or 2–0."},{status:400});
    match.setsA=Array.from({length:action.setsA},()=>1);match.setsB=Array.from({length:action.setsB},()=>1);match.winnerId=action.setsA>action.setsB?match.teamA?.id:match.teamB?.id;
    if(!match.winnerId)return NextResponse.json({error:"Both teams must be assigned before entering a score."},{status:400});match.status="completed";
    const winner=match.winnerId===match.teamA?.id?match.teamA:match.teamB;
    if(match.id==="play-in-m1"&&winner){const slot=state.matches.find(m=>m.teamA?.id==="team-play-in-winner"||m.teamB?.id==="team-play-in-winner");if(slot){if(slot.teamA?.id==="team-play-in-winner")slot.teamA=winner;else slot.teamB=winner;}}
    else if(match.nextMatchId&&winner){const next=state.matches.find(m=>m.id===match.nextMatchId);if(next){if(match.nextSlot==="A")next.teamA=winner;else next.teamB=winner;}}
   }
  }
  await saveTournamentState(state);await writeAdminAudit(profile.login,action.action==="score"?"match_score_saved":"match_scheduled",{match_id:match.id,action});return NextResponse.json({ok:true,state});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Tournament update failed."},{status:503});}
}
