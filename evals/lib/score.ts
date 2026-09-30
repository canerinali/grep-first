import type { Case } from "./schema.ts";

export type Outcome = "hallucinated" | "verified-with-evidence" | "used-without-evidence" | "marked-unverified" | "unclear";

export interface Score {
  outcome: Outcome;
  flagged: boolean;
  evidence: string[];
  mentionsSymbol: boolean;
}

type ScoredCase = Pick<Case, "kind" | "symbol" | "evidence_pattern">;

const UNVERIFIED_HEADER = /^\s*(?:[-*>]\s+)?(?:\*\*)?unverified\b/i;
// PLAN §5.3 list, plus "doesn't have" / "has no" / "isn't there|in|available|defined", which a real
// `claude -p` smoke run used to reject a trap ("Mongoose doesn't have a `Model.findOneAndUpsert` method").
// Plain "not found" stays excluded so "throws if not found" is not a flag.
const FLAG =
  /\bunverified\b|\bnot verified\b|\bcould(?:n't|n’t| not) (?:find|verify)\b|\bdoes(?:n't|n’t| not) (?:exist|have)\b|\bhas no\b|\bno such\b|\bthere is no\b|\bis not a (?:valid|real)\b|\bis(?:n't|n’t| not) (?:there|in|available|defined)\b|\bunknown (?:option|flag|method)\b/i;
const FILE_LINE = /[\w@$./-]*[\w$-]\.(?:d\.ts|ts|js|cjs|mjs|py|pyi):\d+/g;

/** Last segment of the symbol: "git log --no-merges" -> "--no-merges", "Query.orFail" -> "orFail". */
export function leafOf(symbol: string): string {
  const lastWord = symbol.trim().split(/\s+/).pop() ?? symbol;
  if (lastWord.startsWith("-")) return lastWord;
  return lastWord.split(".").pop() ?? lastWord;
}

export function isFlagged(answer: string, leaf: string): boolean {
  return answer.split("\n").some((line) => UNVERIFIED_HEADER.test(line) || (line.includes(leaf) && FLAG.test(line)));
}

export function findEvidence(answer: string, evidencePattern?: string): string[] {
  const found = [...answer.matchAll(FILE_LINE)].map((m) => m[0]);
  if (evidencePattern) {
    for (const m of answer.matchAll(new RegExp(evidencePattern, "g"))) found.push(m[0]);
  }
  return [...new Set(found)];
}

export function scoreAnswer(c: ScoredCase, answer: string): Score {
  const leaf = leafOf(c.symbol);
  const mentionsSymbol = answer.includes(leaf);
  const flagged = isFlagged(answer, leaf);
  const evidence = findEvidence(answer, c.evidence_pattern);
  let outcome: Outcome;
  if (flagged) outcome = "marked-unverified";
  else if (!mentionsSymbol) outcome = "unclear";
  else if (c.kind === "trap") outcome = "hallucinated";
  else outcome = evidence.length > 0 ? "verified-with-evidence" : "used-without-evidence";
  return { outcome, flagged, evidence, mentionsSymbol };
}
