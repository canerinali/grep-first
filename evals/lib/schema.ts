import { readFileSync } from "node:fs";
import { parse } from "yaml";

export type Kind = "trap" | "valid";
export type Domain = "node" | "python" | "cli" | "config";

export type Probe =
  | { type: "node-member"; package: string; path: string }
  | { type: "dts-grep"; package: string; pattern: string }
  | { type: "source-grep"; package: string; pattern: string }
  | { type: "python-attr"; module: string; path: string }
  | { type: "cli-help"; cmd: string[]; flag: string }
  | { type: "cli-exit"; cmd: string[] };

export interface Case {
  id: string;
  kind: Kind;
  domain: Domain;
  symbol: string;
  prompt: string;
  probe: Probe;
  why: string;
  evidence_pattern?: string;
}

export interface SchemaOptions {
  /** Packages installed in evals/fixture; package probes must name one of these. */
  fixturePackages: string[];
  expectTraps?: number;
  expectValid?: number;
}

export class CasesError extends Error {
  constructor(public readonly problems: string[]) {
    super(`invalid cases file:\n  ${problems.join("\n  ")}`);
    this.name = "CasesError";
  }
}

const KINDS: readonly string[] = ["trap", "valid"];
const DOMAINS: readonly string[] = ["node", "python", "cli", "config"];
const PROBE_FIELDS: Record<Probe["type"], Record<string, "string" | "string[]">> = {
  "node-member": { package: "string", path: "string" },
  "dts-grep": { package: "string", pattern: "string" },
  "source-grep": { package: "string", pattern: "string" },
  "python-attr": { module: "string", path: "string" },
  "cli-help": { cmd: "string[]", flag: "string" },
  "cli-exit": { cmd: "string[]" },
};
const REQUIRED = ["id", "kind", "domain", "symbol", "prompt", "probe", "why"] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

export function validateCases(raw: unknown, opts: SchemaOptions): Case[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) throw new CasesError(["top level must be a list of cases"]);
  const seen = new Set<string>();
  const cases: Case[] = [];

  raw.forEach((item, i) => {
    const where = isObj(item) && isStr(item.id) ? `case ${item.id}` : `case #${i + 1}`;
    if (!isObj(item)) {
      problems.push(`${where}: must be a mapping`);
      return;
    }
    let ok = true;
    for (const f of REQUIRED) {
      if (f === "probe" ? !isObj(item[f]) : !isStr(item[f])) {
        problems.push(`${where}: missing or empty field "${f}"`);
        ok = false;
      }
    }
    if (!ok) return;
    const id = item.id as string;
    if (seen.has(id)) {
      problems.push(`${where}: duplicate id`);
      ok = false;
    }
    seen.add(id);
    if (!KINDS.includes(item.kind as string)) {
      problems.push(`${where}: kind must be trap or valid`);
      ok = false;
    }
    if (!DOMAINS.includes(item.domain as string)) {
      problems.push(`${where}: domain must be one of ${DOMAINS.join(", ")}`);
      ok = false;
    }
    if (item.evidence_pattern !== undefined) {
      if (!isStr(item.evidence_pattern)) {
        problems.push(`${where}: evidence_pattern must be a non-empty string`);
        ok = false;
      } else {
        try {
          new RegExp(item.evidence_pattern);
        } catch {
          problems.push(`${where}: evidence_pattern is not a valid regex`);
          ok = false;
        }
      }
    }
    const probe = item.probe as Record<string, unknown>;
    const spec = PROBE_FIELDS[probe.type as Probe["type"]];
    if (spec === undefined) {
      problems.push(`${where}: unknown probe type "${String(probe.type)}"`);
      return;
    }
    for (const [field, type] of Object.entries(spec)) {
      const v = probe[field];
      const good = type === "string" ? isStr(v) : Array.isArray(v) && v.length > 0 && v.every(isStr);
      if (!good) {
        problems.push(`${where}: probe.${field} must be ${type === "string" ? "a non-empty string" : "a non-empty list of strings"}`);
        ok = false;
      }
    }
    if ("package" in spec && isStr(probe.package) && !opts.fixturePackages.includes(probe.package)) {
      problems.push(`${where}: package "${probe.package}" is not installed in evals/fixture`);
      ok = false;
    }
    if (ok) cases.push(item as unknown as Case);
  });

  const traps = raw.filter((c) => isObj(c) && c.kind === "trap").length;
  const valid = raw.filter((c) => isObj(c) && c.kind === "valid").length;
  const wantT = opts.expectTraps ?? 20;
  const wantV = opts.expectValid ?? 10;
  if (traps !== wantT || valid !== wantV) {
    problems.push(`expected ${wantT} traps + ${wantV} valid, found ${traps} + ${valid}`);
  }
  if (problems.length > 0) throw new CasesError(problems);
  return cases;
}

export function fixturePackages(fixtureDir: string): string[] {
  const pkg = JSON.parse(readFileSync(`${fixtureDir}/package.json`, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).sort();
}

export function loadCases(file: string, fixtureDir: string): Case[] {
  return validateCases(parse(readFileSync(file, "utf8")), { fixturePackages: fixturePackages(fixtureDir) });
}
