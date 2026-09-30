import type { Kind } from "./schema.ts";
import type { Outcome } from "./score.ts";

export type Condition = "with-skill" | "without-skill";
export type AgentName = "claude" | "codex";

export interface Row {
  caseId: string;
  agent: AgentName;
  condition: Condition;
  kind: Kind;
  outcome: Outcome | "error";
  tokens: number | null;
}

export interface Metrics {
  agent: AgentName;
  condition: Condition;
  cases: number;
  traps: number;
  valid: number;
  hallucinated: number;
  markedUnverifiedValid: number;
  verifiedWithEvidence: number;
  unclear: number;
  error: number;
  /** hallucinated / scorable traps */
  hallucinationRate: number | null;
  /** marked-unverified / scorable valid */
  falseUnverifiedRate: number | null;
  /** verified-with-evidence / scorable valid */
  evidenceRate: number | null;
  meanTokens: number | null;
  /** mean(with - without) over cases where both runs have tokens; only on the with-skill row */
  tokenDelta: number | null;
  tokenPairs: number;
}

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);
const mean = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
const scorable = (r: Row) => r.outcome !== "unclear" && r.outcome !== "error";

export function aggregate(rows: Row[]): Metrics[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.agent}\u0000${r.condition}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: Metrics[] = [];
  for (const group of groups.values()) {
    const { agent, condition } = group[0]!;
    const traps = group.filter((r) => r.kind === "trap");
    const valid = group.filter((r) => r.kind === "valid");
    const sTraps = traps.filter(scorable);
    const sValid = valid.filter(scorable);
    const hallucinated = sTraps.filter((r) => r.outcome === "hallucinated").length;
    const markedUnverifiedValid = sValid.filter((r) => r.outcome === "marked-unverified").length;
    const verifiedWithEvidence = sValid.filter((r) => r.outcome === "verified-with-evidence").length;

    let tokenDelta: number | null = null;
    let tokenPairs = 0;
    if (condition === "with-skill") {
      const without = new Map(
        rows.filter((r) => r.agent === agent && r.condition === "without-skill").map((r) => [r.caseId, r.tokens]),
      );
      const deltas: number[] = [];
      for (const r of group) {
        const other = without.get(r.caseId);
        if (r.tokens !== null && other !== undefined && other !== null) deltas.push(r.tokens - other);
      }
      tokenPairs = deltas.length;
      tokenDelta = mean(deltas);
    }

    out.push({
      agent,
      condition,
      cases: group.length,
      traps: traps.length,
      valid: valid.length,
      hallucinated,
      markedUnverifiedValid,
      verifiedWithEvidence,
      unclear: group.filter((r) => r.outcome === "unclear").length,
      error: group.filter((r) => r.outcome === "error").length,
      hallucinationRate: ratio(hallucinated, sTraps.length),
      falseUnverifiedRate: ratio(markedUnverifiedValid, sValid.length),
      evidenceRate: ratio(verifiedWithEvidence, sValid.length),
      meanTokens: mean(group.flatMap((r) => (r.tokens === null ? [] : [r.tokens]))),
      tokenDelta,
      tokenPairs,
    });
  }
  const order = (m: Metrics) => `${m.agent}-${m.condition === "with-skill" ? 0 : 1}`;
  return out.sort((a, b) => order(a).localeCompare(order(b)));
}
