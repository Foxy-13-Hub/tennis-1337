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
  winnerId?: string;
  status: MatchStatus;
  scheduledAt?: string;
  court?: string;
  nextMatchId?: string;
  nextSlot?: "A" | "B";
};

export type Tournament = {
  revision?: string;
  name: string;
  status: "upcoming" | "in_progress" | "completed";
  teams: Team[];
  matches: Match[];
  playInMatch?: Match;
};
