import type { Team, Tournament } from "./types";

const requestedPairs = [["moguenia", "aech-che"], ["yoabied", "ait-idi"]] as const;
const loginOf = (player: Team["players"][number]) =>
  (player.login ?? player.id.replace(/^player-/, "")).toLowerCase().replace(/^aait-idi$/, "ait-idi");

/** Keep team IDs, bracket positions, player identities and saved metadata intact.
 * Move requested players into the existing play-in teams by swapping player
 * slots. Displaced players occupy the donor slots, so nobody is duplicated or
 * removed. Once any affected match starts, leave its saved roster untouched.
 */
export function configurePlayInRoster(input: Tournament): Tournament {
  if (!input.playInMatch?.teamA || !input.playInMatch.teamB) return input;
  const ids = [input.playInMatch.teamA.id, input.playInMatch.teamB.id];
  if (ids[0] === ids[1]) return input;
  const state = structuredClone(input);
  const targets = ids.map(id => state.teams.find(team => team.id === id));
  if (targets.some(team => !team)) return input;
  if (!requestedPairs.flat().every(login => state.teams.some(team => team.players.some(player => loginOf(player) === login)))) return input;
  for (const [index, pair] of requestedPairs.entries()) {
    const target = targets[index]!;
    for (const [slot, login] of pair.entries()) {
      const donor = state.teams.find(team => team.players.some(player => loginOf(player) === login))!;
      const donorSlot = donor.players.findIndex(player => loginOf(player) === login);
      [target.players[slot], donor.players[donorSlot]] = [donor.players[donorSlot], target.players[slot]];
    }
  }
  const changed = new Set(state.teams.filter(team => {
    const before = input.teams.find(candidate => candidate.id === team.id)!;
    return team.players.some((player, index) => player.id !== before.players[index].id);
  }).map(team => team.id));
  if (!changed.size) return input;
  const matches = [...state.matches, state.playInMatch!];
  if (matches.some(match => [match.teamA, match.teamB].some(team => team && changed.has(team.id)) &&
    (!["upcoming", "postponed"].includes(match.status) || match.winnerId || match.setsA.length || match.setsB.length || match.gamesA || match.gamesB || match.setHistory?.length))) return input;
  for (const team of state.teams) if (changed.has(team.id)) team.name = team.players.map(player => player.name).join(" + ");
  const roster = new Map(state.teams.map(team => [team.id, team]));
  for (const match of matches) {
    if (match.teamA && changed.has(match.teamA.id)) match.teamA = roster.get(match.teamA.id)!;
    if (match.teamB && changed.has(match.teamB.id)) match.teamB = roster.get(match.teamB.id)!;
  }
  return state;
}
