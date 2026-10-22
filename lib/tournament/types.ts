export type TournamentStatus = "upcoming" | "in_progress" | "completed" | "postponed";
export type MatchStatus = "pending" | "scheduled" | "in_progress" | "completed" | "postponed" | "voided";

export type Player = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
};

export type TeamMember = {
  teamId: string;
  playerId: string;
  memberOrder: number;
  player?: Player;
};

export type Team = {
  id: string;
  tournamentId: string;
  displayName: string;
  seed: number | null;
  members: TeamMember[];
};

export type MatchSet = {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  team1Tiebreak: number | null;
  team2Tiebreak: number | null;
};

export type Match = {
  id: string;
  tournamentId: string;
  roundNumber: number;
  matchNumber: number;
  status: MatchStatus;
  team1Id: string | null;
  team2Id: string | null;
  winnerTeamId: string | null;
  scheduledAt: string | null;
  court: string | null;
  scoreSummary: string | null;
  sets: MatchSet[];
};

export type DrawSlot = {
  position: number;
  teamId: string | null;
  isCorner: boolean;
};

export type DrawGenerationInput = {
  teams: string[];
  cornerTeamIds: {
    topLeft: string;
    bottomLeft: string;
    topRight: string;
    bottomRight: string;
  };
};

export type ImportPlayerRow = {
  line: number;
  login: string;
  displayName: string;
  partnerLogin?: string;
};
