import { demoTournament } from "../../src/lib/demo-data";
/** Old unstarted persisted draw with different play-in participants. */
export function legacyPlayInDraw() {
  const state = structuredClone(demoTournament);
  const playInIds = [state.playInMatch!.teamA!.id, state.playInMatch!.teamB!.id];
  const donors = state.teams.filter(team => !["team-1","team-2","team-3","team-4",...playInIds].includes(team.id)).slice(0,2);
  for (let i=0;i<2;i++) {
    const target = state.teams.find(team=>team.id===playInIds[i])!;
    [target.players,donors[i].players]=[donors[i].players,target.players];
  }
  for(const team of state.teams) team.name=team.players.map(player=>player.name).join(" + ");
  for(const match of [...state.matches,state.playInMatch!]) {
    if(match.teamA) match.teamA=state.teams.find(team=>team.id===match.teamA!.id) ?? match.teamA;
    if(match.teamB) match.teamB=state.teams.find(team=>team.id===match.teamB!.id) ?? match.teamB;
  }
  return state;
}
