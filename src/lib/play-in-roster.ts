import type { Team, Tournament } from "./types";

export const playInDisplayNames: Record<string, string> = { moguenia: "Moguenia", "aech-che": "Aech-Che", yoabied: "Yoabied", "ait-idi": "Ait-Idi" };
const requestedPairs = [["moguenia", "aech-che"], ["yoabied", "ait-idi"]] as const;
const loginOf = (player: Team["players"][number]) =>
  (player.login ?? player.id.replace(/^player-/, "")).toLowerCase().replace(/^aait-idi$/, "ait-idi");

/** Keep team IDs, bracket positions, player identities and saved metadata intact.
 * Move requested players into the existing play-in teams by swapping player
 * slots. Displaced players occupy the donor slots, so nobody is duplicated or
 * removed. Once any affected match starts, leave its saved roster untouched.
 */
export function configurePlayInRoster(input: Tournament): Tournament {
  if (input.rosterManaged) return input;
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
  const changed = new Set<string>();
  for (const team of state.teams) {
    // Upgrade original login labels while keeping custom administrator names.
    for (const player of team.players) {
      const login = loginOf(player);
      if (playInDisplayNames[login] && player.name.toLowerCase().replace(/^aait-idi$/, "ait-idi") === login) {
        player.name = playInDisplayNames[login];
      }
    }
    const before = input.teams.find(candidate => candidate.id === team.id)!;
    if (JSON.stringify(team.players) !== JSON.stringify(before.players)) {
      changed.add(team.id);
      team.name = team.players.map(player => player.name).join(" + ");
    }
  }
  const matches = [...state.matches, state.playInMatch!];
  const roster = new Map(state.teams.map(team => [team.id, team]));
  // Persisted JSON contains independent team copies. Correcting the canonical
  // roster alone must not leave the public play-in showing old participants.
  for (const match of matches) for (const team of [match.teamA, match.teamB]) {
    if (team && ids.includes(team.id) && JSON.stringify(team) !== JSON.stringify(roster.get(team.id))) changed.add(team.id);
  }
  if (!changed.size) return input;
  if (matches.some(match => [match.teamA, match.teamB].some(team => team && changed.has(team.id)) &&
    (!["upcoming", "postponed"].includes(match.status) || match.winnerId || match.setsA.length || match.setsB.length || match.gamesA || match.gamesB || match.setHistory?.length))) return input;
  for (const match of matches) {
    if (match.teamA && changed.has(match.teamA.id)) match.teamA = roster.get(match.teamA.id)!;
    if (match.teamB && changed.has(match.teamB.id)) match.teamB = roster.get(match.teamB.id)!;
  }
  return state;
}
