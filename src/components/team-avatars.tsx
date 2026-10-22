import type { Team } from "@/lib/types";
import { Avatar } from "./avatar";
export function TeamAvatars({ team }: { team: Team }) {
  return <div className="team-avatar-pair"><Avatar name={team.players[0].name} image={team.players[0].image}/><Avatar name={team.players[1].name} image={team.players[1].image}/></div>;
}
