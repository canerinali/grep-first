import { describe, expect, it } from "vitest";
import { aggregate, type Row } from "../evals/lib/metrics.ts";
import { renderReport } from "../evals/lib/report.ts";

const row = (caseId: string, condition: Row["condition"], kind: Row["kind"], outcome: Row["outcome"], tokens: number | null): Row => ({
  caseId,
  agent: "claude",
  condition,
  kind,
  outcome,
  tokens,
});

// Synthetic rows.
const rows: Row[] = [
  row("t1", "with-skill", "trap", "marked-unverified", 1200),
  row("t2", "with-skill", "trap", "hallucinated", 1000),
  row("t3", "with-skill", "trap", "unclear", null),
  row("t4", "with-skill", "trap", "error", null),
  row("v1", "with-skill", "valid", "verified-with-evidence", 900),
  row("v2", "with-skill", "valid", "marked-unverified", 800),
  row("t1", "without-skill", "trap", "hallucinated", 700),
  row("t2", "without-skill", "trap", "hallucinated", null),
  row("t3", "without-skill", "trap", "hallucinated", 600),
  row("t4", "without-skill", "trap", "hallucinated", 500),
  row("v1", "without-skill", "valid", "used-without-evidence", 400),
  row("v2", "without-skill", "valid", "used-without-evidence", 300),
];

describe("aggregate", () => {
  const [withSkill, without] = aggregate(rows);

  it("orders with-skill before without-skill", () => {
    expect(withSkill!.condition).toBe("with-skill");
    expect(without!.condition).toBe("without-skill");
  });

  it("excludes unclear and error from the hallucination denominator", () => {
    expect(withSkill).toMatchObject({ traps: 4, hallucinated: 1, unclear: 1, error: 1 });
    expect(withSkill!.hallucinationRate).toBe(0.5);
    expect(without!.hallucinationRate).toBe(1);
  });

  it("computes false-unverified and evidence rates over valid cases", () => {
    expect(withSkill!.falseUnverifiedRate).toBe(0.5);
    expect(withSkill!.evidenceRate).toBe(0.5);
    expect(without!.falseUnverifiedRate).toBe(0);
    expect(without!.evidenceRate).toBe(0);
  });

  it("mean tokens ignores nulls", () => {
    expect(withSkill!.meanTokens).toBe((1200 + 1000 + 900 + 800) / 4);
    expect(without!.meanTokens).toBe((700 + 600 + 500 + 400 + 300) / 5);
  });

  it("token delta uses only pairs where both sides are non-null", () => {
    // pairs: t1 (1200-700), v1 (900-400), v2 (800-300); t2 has null without, t3/t4 null with.
    expect(withSkill!.tokenPairs).toBe(3);
    expect(withSkill!.tokenDelta).toBe(500);
    expect(without!.tokenDelta).toBeNull();
  });

  it("returns null rates when a denominator is empty", () => {
    const [m] = aggregate([row("t1", "with-skill", "trap", "unclear", null)]);
    expect(m!.hallucinationRate).toBeNull();
    expect(m!.falseUnverifiedRate).toBeNull();
    expect(m!.meanTokens).toBeNull();
    expect(m!.tokenDelta).toBeNull();
  });
});

describe("renderReport", () => {
  it("renders the summary and per-case tables", () => {
    const md = renderReport({
      title: "grep-first eval: claude",
      generatedAt: "2026-09-30T00:00:00Z",
      casesFile: "evals/cases.yaml",
      model: null,
      metrics: aggregate(rows),
      rows,
    });
    expect(md).toContain("| claude | with-skill | 6 | 50.0% (1/2) | 50.0% | 50.0% | 1 | 1 | 975 | +500 (3 pairs) |");
    expect(md).toContain("| claude | without-skill | 6 | 100.0% (4/4) | 0.0% | 0.0% | 0 | 0 | 500 |  |");
    expect(md).toContain("| t2 | trap | claude | without-skill | hallucinated | n/a |");
  });
});
