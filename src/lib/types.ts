export type Player = {
  id: string;
  name: string;
  image: string;
  login?: string;
};

export type Team = {
  id: string;
  name: string;
  players: [Player, Player];
};

export type MatchStatus = "upcoming" | "live" | "completed" | "postponed" | "bye";

export type Match = {
  id: string;
  round: number;
  position: number;
  teamA: Team | null;
  teamB: Team | null;
  setsA: number[];
  setsB: number[];
  gamesA?: number;
  gamesB?: number;
  setHistory?: { gamesA: number; gamesB: number }[];
  scoreUpdatedAt?: string;
  winnerId?: string;
  status: MatchStatus;
  scheduledAt?: string;
  court?: string;
  nextMatchId?: string;
  nextSlot?: "A" | "B";
};

export type Tournament = {
  rosterManaged?: boolean;
  revision?: string;
  scoringConfig?: { bestOf: 3 | 5; tiebreak: boolean; decidingSetTiebreak: boolean };
  name: string;
  status: "upcoming" | "in_progress" | "completed";
  teams: Team[];
  matches: Match[];
  playInMatch?: Match;
};
