import type { Match } from "./types";
export function scoreLabel(match: Match, side: "A" | "B") {
  return `${(side === "A" ? match.setsA : match.setsB).length} [${(side === "A" ? match.gamesA : match.gamesB) ?? 0}]`;
}
export function setHistoryLabel(match: Match) {
  return match.setHistory?.map(set => `${set.gamesA}–${set.gamesB}`).join(", ") ?? "";
}
export function changeGames(value: number, delta: number) {
  return Math.max(0, Math.min(100, value + delta));
}
