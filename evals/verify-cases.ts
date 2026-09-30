import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runProbe } from "./lib/probe.ts";
import { CasesError, loadCases, type Case } from "./lib/schema.ts";

export const FIXTURE_DIR = resolve(fileURLToPath(new URL("./fixture", import.meta.url)));
export const DEFAULT_CASES = resolve(fileURLToPath(new URL("./cases.yaml", import.meta.url)));

export interface Verdict {
  c: Case;
  pass: boolean;
  asLabeled: boolean;
  detail: string;
}

export function verifyCases(cases: Case[], fixtureDir = FIXTURE_DIR): Verdict[] {
  return cases.map((c) => {
    const r = runProbe(c.probe, fixtureDir);
    return { c, pass: r.pass, asLabeled: c.kind === "valid" ? r.pass : !r.pass, detail: r.detail };
  });
}

function main(): void {
  const file = process.argv[2] ?? DEFAULT_CASES;
  let cases: Case[];
  try {
    cases = loadCases(file, FIXTURE_DIR);
  } catch (err) {
    console.error(err instanceof CasesError ? err.message : String(err));
    process.exit(2);
  }
  const verdicts = verifyCases(cases);
  for (const v of verdicts) {
    const mark = v.asLabeled ? "ok  " : "FAIL";
    console.log(`${mark} ${v.c.kind.padEnd(5)} ${v.c.id.padEnd(42)} probe ${v.pass ? "pass" : "fail"}  ${v.detail}`);
  }
  const good = verdicts.filter((v) => v.asLabeled).length;
  console.log(`\n${good}/${verdicts.length} cases behave as labeled`);
  if (good !== verdicts.length) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
