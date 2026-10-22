import { z } from "zod";

import type { DrawGenerationInput, DrawSlot } from "@/lib/tournament/types";

const cornerSchema = z.object({
  topLeft: z.string().min(1),
  bottomLeft: z.string().min(1),
  topRight: z.string().min(1),
  bottomRight: z.string().min(1),
});

const drawInputSchema = z.object({
  teams: z.array(z.string().min(1)).min(4),
  cornerTeamIds: cornerSchema,
});

export function nextPowerOfTwo(value: number): number {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}

export function getCornerPositions(capacity: number) {
  if (capacity < 4 || capacity % 2 !== 0) {
    throw new Error("Bracket capacity must be an even number >= 4");
  }

  return {
    topLeft: 1,
    bottomLeft: capacity / 2,
    topRight: capacity / 2 + 1,
    bottomRight: capacity,
  };
}

function fisherYatesShuffle<T>(values: T[]): T[] {
  const data = [...values];
  for (let i = data.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [data[i], data[j]] = [data[j], data[i]];
  }
  return data;
}

export function generateDrawSlots(input: DrawGenerationInput): {
  capacity: number;
  slots: DrawSlot[];
} {
  const parsed = drawInputSchema.parse(input);

  const uniqueTeamIds = new Set(parsed.teams);
  if (uniqueTeamIds.size !== parsed.teams.length) {
    throw new Error("Duplicate teams are not allowed in draw generation");
  }

  const cornerIds = Object.values(parsed.cornerTeamIds);
  const uniqueCornerIds = new Set(cornerIds);

  if (uniqueCornerIds.size !== 4) {
    throw new Error("Corner team selections must be unique");
  }

  const allCornersExist = cornerIds.every((teamId) => uniqueTeamIds.has(teamId));
  if (!allCornersExist) {
    throw new Error("All corner team IDs must be part of eligible teams");
  }

  const capacity = nextPowerOfTwo(parsed.teams.length);
  const positions = getCornerPositions(capacity);
  const slots: DrawSlot[] = Array.from({ length: capacity }, (_, index) => ({
    position: index + 1,
    teamId: null,
    isCorner: false,
  }));

  const cornerPositionMap = {
    [positions.topLeft]: parsed.cornerTeamIds.topLeft,
    [positions.bottomLeft]: parsed.cornerTeamIds.bottomLeft,
    [positions.topRight]: parsed.cornerTeamIds.topRight,
    [positions.bottomRight]: parsed.cornerTeamIds.bottomRight,
  };

  for (const [position, teamId] of Object.entries(cornerPositionMap)) {
    const slot = slots[Number(position) - 1];
    slot.teamId = teamId;
    slot.isCorner = true;
  }

  const remainingTeams = fisherYatesShuffle(
    parsed.teams.filter((teamId) => !uniqueCornerIds.has(teamId)),
  );

  let currentIndex = 0;
  for (const slot of slots) {
    if (slot.teamId !== null) {
      continue;
    }

    slot.teamId = remainingTeams[currentIndex] ?? null;
    currentIndex += 1;
  }

  return { capacity, slots };
}

export type BracketMatchNode = {
  roundNumber: number;
  matchNumber: number;
  leftSourceMatchNumber: number | null;
  rightSourceMatchNumber: number | null;
};

export function generateBracketMatches(capacity: number): BracketMatchNode[] {
  if (capacity < 2 || capacity % 2 !== 0) {
    throw new Error("Capacity must be an even value >= 2");
  }

  const rounds = Math.log2(capacity);
  if (!Number.isInteger(rounds)) {
    throw new Error("Capacity must be a power of two");
  }

  const nodes: BracketMatchNode[] = [];
  const roundOffsets: number[] = [0];

  let globalCounter = 1;
  for (let round = 1; round <= rounds; round += 1) {
    const matchesInRound = capacity / 2 ** round;
    roundOffsets[round] = globalCounter;

    for (let matchIndex = 1; matchIndex <= matchesInRound; matchIndex += 1) {
      const left = round === 1 ? null : roundOffsets[round - 1] + (matchIndex - 1) * 2;
      const right = round === 1 ? null : (left as number) + 1;
      nodes.push({
        roundNumber: round,
        matchNumber: matchIndex,
        leftSourceMatchNumber: left,
        rightSourceMatchNumber: right,
      });
      globalCounter += 1;
    }
  }

  return nodes;
}
