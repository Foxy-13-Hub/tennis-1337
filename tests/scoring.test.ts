import { describe, expect, it } from "vitest";

import { validateTennisScore } from "../lib/tournament/scoring";

describe("score validation", () => {
  it("accepts valid best-of-three score", () => {
    const result = validateTennisScore({
      bestOf: 3,
      sets: [
        { team1Games: 6, team2Games: 4 },
        { team1Games: 3, team2Games: 6 },
        { team1Games: 7, team2Games: 6 },
      ],
    });

    expect(result.winner).toBe("team1");
    expect(result.summary).toBe("6-4, 3-6, 7-6");
  });

  it("rejects impossible or incomplete results", () => {
    expect(() =>
      validateTennisScore({
        bestOf: 3,
        sets: [
          { team1Games: 6, team2Games: 4 },
          { team1Games: 6, team2Games: 6 },
        ],
      }),
    ).toThrow();

    expect(() =>
      validateTennisScore({
        bestOf: 3,
        sets: [
          { team1Games: 6, team2Games: 0 },
          { team1Games: 0, team2Games: 6 },
        ],
      }),
    ).toThrow();
  });
});
