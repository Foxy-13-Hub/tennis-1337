import { describe, expect, it } from "vitest";

import { pairIndividuals, previewImport } from "../lib/tournament/importer";

describe("t.txt importer", () => {
  it("parses individual rows and catches unmatched player", () => {
    const preview = previewImport("a\nb\nc");

    expect(preview.mode).toBe("individuals");
    expect(preview.unmatchedPlayers).toEqual(["c"]);
  });

  it("parses pair rows and flags duplicate membership", () => {
    const preview = previewImport("alice,bob\ncharlie,bob");

    expect(preview.mode).toBe("pairs");
    expect(preview.errors.some((error) => error.includes("already appears"))).toBe(true);
  });

  it("pairs individuals exactly two by two", () => {
    const preview = previewImport("a\nb\nc\nd");
    const teams = pairIndividuals(preview.parsedRows);

    expect(teams).toEqual([
      { playerA: "a", playerB: "b" },
      { playerA: "c", playerB: "d" },
    ]);
  });
});
