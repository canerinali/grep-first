import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { runProbe } from "../evals/lib/probe.ts";
import { CasesError, fixturePackages, loadCases, validateCases, type Probe } from "../evals/lib/schema.ts";

const FIXTURE = "evals/fixture";
const raw = () => parse(readFileSync("evals/cases.yaml", "utf8")) as Record<string, unknown>[];
const opts = { fixturePackages: fixturePackages(FIXTURE) };

function problemsOf(input: unknown): string[] {
  try {
    validateCases(input, opts);
  } catch (err) {
    if (err instanceof CasesError) return err.problems;
    throw err;
  }
  return [];
}

describe("cases schema", () => {
  it("lists the fixture packages", () => {
    expect(opts.fixturePackages).toEqual(["commander", "dotenv", "mongoose", "yaml"]);
  });

  it("accepts the shipped cases.yaml with 20 traps and 10 valid", () => {
    const cases = loadCases("evals/cases.yaml", FIXTURE);
    expect(cases.filter((c) => c.kind === "trap")).toHaveLength(20);
    expect(cases.filter((c) => c.kind === "valid")).toHaveLength(10);
  });

  it("rejects a duplicate id", () => {
    const cases = raw();
    cases[1] = { ...cases[1], id: cases[0]!.id };
    expect(problemsOf(cases).some((p) => /duplicate id/.test(p))).toBe(true);
  });

  it("rejects an unknown probe type", () => {
    const cases = raw();
    cases[0] = { ...cases[0], probe: { type: "web-search", query: "x" } };
    expect(problemsOf(cases)).toContain(`case ${String(cases[0]!.id)}: unknown probe type "web-search"`);
  });

  it("rejects a 19/10 split", () => {
    const cases = raw();
    const i = cases.findIndex((c) => c.kind === "trap");
    cases.splice(i, 1);
    expect(problemsOf(cases)).toContain("expected 20 traps + 10 valid, found 19 + 10");
  });

  it("rejects a package that is not installed in the fixture", () => {
    const cases = raw();
    cases[0] = { ...cases[0], probe: { type: "node-member", package: "lodash", path: "chunk" } };
    expect(problemsOf(cases).some((p) => /package "lodash" is not installed/.test(p))).toBe(true);
  });

  it("rejects missing required fields and bad kind/domain", () => {
    const cases = raw();
    const { why: _why, ...noWhy } = cases[0]!;
    cases[0] = noWhy;
    cases[1] = { ...cases[1], kind: "maybe", domain: "rust" };
    const p = problemsOf(cases);
    expect(p.some((m) => /missing or empty field "why"/.test(m))).toBe(true);
    expect(p.some((m) => /kind must be trap or valid/.test(m))).toBe(true);
    expect(p.some((m) => /domain must be one of/.test(m))).toBe(true);
  });

  it("rejects a non-list top level", () => {
    expect(problemsOf({ id: "x" })).toEqual(["top level must be a list of cases"]);
  });
});

// Positive controls: the same probe mechanism must PASS for the real neighbour of each trap,
// otherwise a trap could "fail" only because the probe is broken.
describe("probe positive controls", () => {
  const controls: [string, Probe][] = [
    ["Model.findOneAndUpdate", { type: "node-member", package: "mongoose", path: "Model.findOneAndUpdate" }],
    ["Command.requiredOption", { type: "node-member", package: "commander", path: "Command.prototype.requiredOption" }],
    ["itertools.batched", { type: "python-attr", module: "itertools", path: "batched" }],
    ["os.walk", { type: "python-attr", module: "os", path: "walk" }],
    ["'bufferTimeoutMS'", { type: "source-grep", package: "mongoose", pattern: "'bufferTimeoutMS'" }],
    ["timestamps schema option", { type: "dts-grep", package: "mongoose", pattern: "\\btimestamps\\??:" }],
    ["dotenv quiet option", { type: "dts-grep", package: "dotenv", pattern: "\\bquiet\\??:" }],
    ["DOTENV_QUIET env", { type: "source-grep", package: "dotenv", pattern: "DOTENV_(CONFIG_)?QUIET" }],
    ["node --test-concurrency", { type: "cli-help", cmd: ["node", "--help"], flag: "--test-concurrency" }],
    ["git commit --no-verify", { type: "cli-exit", cmd: ["git", "commit", "--no-verify", "--allow-empty", "-m", "x"] }],
  ];
  for (const [name, probe] of controls) {
    it(`passes for ${name}`, () => {
      expect(runProbe(probe, FIXTURE).pass).toBe(true);
    });
  }
});
