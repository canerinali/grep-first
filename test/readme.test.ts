import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const README = readFileSync("README.md", "utf8");
const NO_RESULTS = "No published results yet. Numbers will appear here only as a verbatim copy of a runner `report.md`.";

function resultsBlock(md: string): string {
  const m = /<!-- results:start -->\n([\s\S]*?)\n?<!-- results:end -->/.exec(md);
  if (!m) throw new Error("results markers missing");
  return (m[1] ?? "").trim();
}

function committedReports(): string[] {
  const root = "evals/results";
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "report.md")))
    .map((d) => readFileSync(join(root, d.name, "report.md"), "utf8").trim());
}

describe("README", () => {
  it("results block is the no-results sentence or a verbatim runner report", () => {
    const block = resultsBlock(README);
    expect(block === NO_RESULTS || committedReports().includes(block)).toBe(true);
  });

  it("has no metric numbers outside the results block", () => {
    const outside = README.replace(/<!-- results:start -->[\s\S]*?<!-- results:end -->/, "");
    expect(outside).not.toMatch(/\d+(\.\d+)?\s?%/);
    expect(outside).not.toMatch(/\b(hallucination|false-unverified|evidence) rate (of|is|was|drops?|fell)\b/i);
  });

  it("opens with what it does, a one-line install and a one-line usage example", () => {
    const [what, install, usage] = README.split("\n");
    expect(what).toMatch(/^# grep-first/);
    expect(install).toMatch(/cp -r grep-first\/skills\/grep-first ~\/\.claude\/skills\//);
    expect(usage).toMatch(/Unverified: Model\.findOneAndUpsert/);
    expect(README).toContain("<!-- badges -->");
  });

  it("labels the before/after as illustrative", () => {
    expect(README).toMatch(/## Before \/ after\n\nIllustrative/);
  });

  it("keeps the features list to at most 10 one-line items", () => {
    const section = /## Features\n\n([\s\S]*?)\n\n## /.exec(README)?.[1] ?? "";
    const items = section.split("\n").filter((l) => l.startsWith("- "));
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(10);
    expect(section.split("\n").every((l) => l.startsWith("- "))).toBe(true);
  });

  it("quotes the real output of examples/verify-symbol.sh", async () => {
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync("bash", ["examples/verify-symbol.sh"], { encoding: "utf8" }).trim();
    expect(README).toContain(`$ ./examples/verify-symbol.sh\n${out}\n`);
  });
});
