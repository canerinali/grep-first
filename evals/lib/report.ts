import type { Metrics, Row } from "./metrics.ts";

export interface ReportInput {
  title: string;
  generatedAt: string;
  casesFile: string;
  model: string | null;
  metrics: Metrics[];
  rows: Row[];
}

const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x: number | null) => (x === null ? "n/a" : Math.round(x).toString());
const signed = (x: number | null) => (x === null ? "n/a" : `${x >= 0 ? "+" : ""}${Math.round(x)}`);

export function renderReport(input: ReportInput): string {
  const lines: string[] = [
    `# ${input.title}`,
    "",
    `Generated ${input.generatedAt} from \`${input.casesFile}\`, model: ${input.model ?? "agent default"}.`,
    "",
    "| Agent | Condition | Cases | Hallucination rate | False-unverified rate | Evidence rate | Unclear | Error | Mean tokens | Token delta |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const m of input.metrics) {
    const delta = m.condition === "with-skill" ? `${signed(m.tokenDelta)} (${m.tokenPairs} pairs)` : "";
    lines.push(
      `| ${m.agent} | ${m.condition} | ${m.cases} | ${pct(m.hallucinationRate)} (${m.hallucinated}/${m.traps - countExcluded(input.rows, m, "trap")}) | ${pct(m.falseUnverifiedRate)} | ${pct(m.evidenceRate)} | ${m.unclear} | ${m.error} | ${num(m.meanTokens)} | ${delta} |`,
    );
  }
  lines.push(
    "",
    "Rates exclude `unclear` and `error` rows from their denominators. Token delta is with-skill minus without-skill, paired by case, non-null pairs only.",
    "",
    "| Case | Kind | Agent | Condition | Outcome | Tokens |",
    "|---|---|---|---|---|---:|",
  );
  for (const r of input.rows) {
    lines.push(`| ${r.caseId} | ${r.kind} | ${r.agent} | ${r.condition} | ${r.outcome} | ${r.tokens ?? "n/a"} |`);
  }
  return `${lines.join("\n")}\n`;
}

function countExcluded(rows: Row[], m: Metrics, kind: Row["kind"]): number {
  return rows.filter(
    (r) =>
      r.agent === m.agent &&
      r.condition === m.condition &&
      r.kind === kind &&
      (r.outcome === "unclear" || r.outcome === "error"),
  ).length;
}
