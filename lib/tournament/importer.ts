import { z } from "zod";

import type { ImportPlayerRow } from "@/lib/tournament/types";

const playerTokenSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-zA-Z0-9._-]+$/);

const separators = ["|", ";", ",", "\t"];

function splitLine(rawLine: string) {
  for (const separator of separators) {
    if (rawLine.includes(separator)) {
      return rawLine.split(separator).map((value) => value.trim());
    }
  }

  return rawLine
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export type ImportPreview = {
  mode: "individuals" | "pairs";
  parsedRows: ImportPlayerRow[];
  errors: string[];
  warnings: string[];
  duplicates: string[];
  unmatchedPlayers: string[];
};

export function previewImport(rawContent: string): ImportPreview {
  const lines = rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedRows: ImportPlayerRow[] = [];

  lines.forEach((line, index) => {
    const columns = splitLine(line);

    if (columns.length < 1) {
      errors.push(`Line ${index + 1}: Empty row`);
      return;
    }

    if (columns.length > 4) {
      errors.push(`Line ${index + 1}: Too many columns`);
      return;
    }

    const login = columns[0] ?? "";
    const displayName = columns[1] || columns[0] || "";
    const partnerLogin = columns[2] || columns[1] || undefined;

    const result = playerTokenSchema.safeParse(login);
    if (!result.success) {
      errors.push(`Line ${index + 1}: Invalid login \"${login}\"`);
      return;
    }

    parsedRows.push({
      line: index + 1,
      login: result.data.toLowerCase(),
      displayName,
      partnerLogin: partnerLogin?.toLowerCase(),
    });
  });

  const pairMode = parsedRows.some((row) => Boolean(row.partnerLogin));
  const mode = pairMode ? "pairs" : "individuals";

  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const row of parsedRows) {
    if (seen.has(row.login)) duplicates.push(row.login);
    seen.add(row.login);
  }

  if (mode === "pairs") {
    const membership = new Map<string, string>();
    for (const row of parsedRows) {
      if (!row.partnerLogin) {
        errors.push(`Line ${row.line}: Missing partner login in pair mode`);
        continue;
      }

      const partnerResult = playerTokenSchema.safeParse(row.partnerLogin);
      if (!partnerResult.success) {
        errors.push(`Line ${row.line}: Invalid partner login \"${row.partnerLogin}\"`);
        continue;
      }

      if (row.login === row.partnerLogin) {
        errors.push(`Line ${row.line}: Player cannot be paired with self`);
      }

      if (membership.has(row.login)) {
        errors.push(`Line ${row.line}: ${row.login} already appears in another pair`);
      }

      if (membership.has(row.partnerLogin)) {
        errors.push(`Line ${row.line}: ${row.partnerLogin} already appears in another pair`);
      }

      membership.set(row.login, row.partnerLogin);
      membership.set(row.partnerLogin, row.login);
    }
  }

  const unmatchedPlayers: string[] = [];
  if (mode === "individuals" && parsedRows.length % 2 !== 0) {
    unmatchedPlayers.push(parsedRows[parsedRows.length - 1]?.login ?? "unknown");
  }

  if (parsedRows.length === 0) {
    errors.push("No importable rows found");
  }

  if (duplicates.length > 0) {
    warnings.push(`Duplicate players detected: ${duplicates.join(", ")}`);
  }

  return {
    mode,
    parsedRows,
    errors,
    warnings,
    duplicates,
    unmatchedPlayers,
  };
}

export function pairIndividuals(rows: ImportPlayerRow[]) {
  if (rows.length % 2 !== 0) {
    throw new Error("Cannot auto-pair odd number of players");
  }

  const teams: Array<{ playerA: string; playerB: string }> = [];
  for (let index = 0; index < rows.length; index += 2) {
    teams.push({
      playerA: rows[index].login,
      playerB: rows[index + 1].login,
    });
  }

  return teams;
}
