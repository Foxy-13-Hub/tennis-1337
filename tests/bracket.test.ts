import { describe, expect, it, vi } from "vitest";

import { generateBracketMatches, generateDrawSlots, getCornerPositions, nextPowerOfTwo } from "../lib/tournament/bracket";

describe("bracket generation", () => {
  it("handles next power of two and byes", () => {
    expect(nextPowerOfTwo(48)).toBe(64);
  });

  it("pins corner teams and avoids duplication", () => {
    const teams = Array.from({ length: 10 }, (_, index) => `team-${index + 1}`);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const draw = generateDrawSlots({
      teams,
      cornerTeamIds: {
        topLeft: "team-1",
        bottomLeft: "team-2",
        topRight: "team-3",
        bottomRight: "team-4",
      },
    });

    const corners = getCornerPositions(draw.capacity);
    const slotsByPosition = new Map(draw.slots.map((slot) => [slot.position, slot.teamId]));

    expect(slotsByPosition.get(corners.topLeft)).toBe("team-1");
    expect(slotsByPosition.get(corners.bottomLeft)).toBe("team-2");
    expect(slotsByPosition.get(corners.topRight)).toBe("team-3");
    expect(slotsByPosition.get(corners.bottomRight)).toBe("team-4");

    const assigned = draw.slots.map((slot) => slot.teamId).filter(Boolean);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it("creates stable dependency tree shape", () => {
    const nodes = generateBracketMatches(8);
    expect(nodes.filter((node) => node.roundNumber === 1)).toHaveLength(4);
    expect(nodes.filter((node) => node.roundNumber === 2)).toHaveLength(2);
    expect(nodes.filter((node) => node.roundNumber === 3)).toHaveLength(1);
  });
});
