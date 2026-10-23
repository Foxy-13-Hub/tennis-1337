import type { Player, Team, Tournament } from "./types";
import { playerLogins } from "./player-logins";
import { generateBracket, shuffle } from "./bracket";

export function slug(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
const player = (login: string): Player => ({ id: `player-${login.toLowerCase()}`, login, name: login, image: login === "aait-idi" ? "/players/default.svg" : `/players/${login}.png` });
const fixedPairs = [
  ["amissa", "bdebbagh"], // top-left
  ["nel-khal", "masliman"], // bottom-left
  ["amedina", "CHEF-AYOUB"], // top-right
  ["nikhtib", "meel-bar"], // bottom-right
] as const;
const reserved = new Set<string>(fixedPairs.flat());
// A reproducible preview also makes first initialization safe across workers.
let seed = 1337;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const remaining = shuffle(playerLogins.filter(login => !reserved.has(login)), random);
const randomPairs: string[][] = [];
for (let i = 0; i < remaining.length; i += 2) randomPairs.push([remaining[i], remaining[i + 1]]);
const pairs = [...fixedPairs, ...randomPairs];
export const tournamentTeams: Team[] = pairs.map((pair, index) => {
  const members = pair.map(player) as [Player, Player];
  return { id: `team-${index + 1}`, name: pair.join(" + "), players: members };
});
export const cornerTeamIds = {
  topLeft: "team-1",
  bottomLeft: "team-2",
  topRight: "team-3",
  bottomRight: "team-4",
};
// Keep the four requested corner teams in the main draw. Two other teams are
// selected randomly for a preliminary play-in; its winner takes the 16th slot.
const cornerIds = new Set(Object.values(cornerTeamIds));
const eligibleForPlayIn = shuffle(tournamentTeams.filter(team => !cornerIds.has(team.id)), random);
export const playInTeams = eligibleForPlayIn.slice(0, 2);
const playInWinnerSlot: Team = {
  id: "team-play-in-winner",
  name: "Winner of play-in",
  players: [
    { id: "play-in-winner-a", name: "Play-in winner", image: "/players/default.svg" },
    { id: "play-in-winner-b", name: "Play-in winner", image: "/players/default.svg" },
  ],
};
const mainDrawTeams = [
  ...tournamentTeams.filter(team => !playInTeams.some(candidate => candidate.id === team.id)),
  playInWinnerSlot,
];
export const demoTournament: Tournament = {
  name: "1337 Tennis Open",
  status: "upcoming",
  teams: tournamentTeams,
  matches: generateBracket(mainDrawTeams, cornerTeamIds, random),
  playInMatch: {
    id: "play-in-m1", round: 0, position: 0,
    teamA: playInTeams[0], teamB: playInTeams[1], setsA: [], setsB: [], status: "upcoming",
  },
};
