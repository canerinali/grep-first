import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildArgv, parseOutput, SKILL_DIR_IN_WORKDIR, type Invocation } from "./lib/agents.ts";
import { aggregate, type AgentName, type Condition, type Row } from "./lib/metrics.ts";
import { renderReport } from "./lib/report.ts";
import { CasesError, loadCases, type Case } from "./lib/schema.ts";
import { scoreAnswer, type Score } from "./lib/score.ts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FIXTURE_DIR = join(ROOT, "evals", "fixture");
const SKILL_DIR = join(ROOT, "skills", "grep-first");

const USAGE = `Usage: npx tsx evals/run.ts --agent claude|codex [options]

  --cases <file>      case file (default evals/cases.yaml)
  --with-skill        run only the with-skill condition
  --without-skill     run only the without-skill condition (neither flag = both, alternating per case)
  --limit N           first N cases after --only filtering
  --only <prefix>     keep cases whose id starts with <prefix>
  --model <m>         passed through to the agent
  --timeout <s>       per-case kill timeout in seconds (default 180)
  --out <dir>         results root (default evals/results/)
  --dry-run           print each argv (JSON) and the workdir plan; spawn nothing

Exit codes: 0 ok, 1 a case run failed, 2 bad args / bad cases file / contamination detected.

Security: this spawns a real agent under your user account. Claude runs with
--allowedTools incl. Bash(node:*), Bash(python3:*), Bash(git:*) and Bash(find:*),
which can execute arbitrary code outside the temp workdir (no filesystem sandbox).
Codex runs with --sandbox read-only. Run it only on a machine/account you are
comfortable letting the agent act on, or inside a container/VM.`;

export const CLAUDE_EXEC_WARNING =
  "warning: claude runs with Bash(node:*), Bash(python3:*), Bash(git:*), Bash(find:*) allowed; " +
  "that is arbitrary code execution as your user, not a sandbox. See --help.";

class UsageError extends Error {}

export interface RunOptions {
  agent: AgentName;
  casesFile: string;
  conditions: Condition[] | "both";
  limit: number | null;
  only: string | null;
  model: string | null;
  timeoutS: number;
  outDir: string;
  dryRun: boolean;
}

export function parseCli(argv: string[]): RunOptions | "help" {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        agent: { type: "string" },
        cases: { type: "string", default: "evals/cases.yaml" },
        "with-skill": { type: "boolean", default: false },
        "without-skill": { type: "boolean", default: false },
        limit: { type: "string" },
        only: { type: "string" },
        model: { type: "string" },
        timeout: { type: "string", default: "180" },
        out: { type: "string", default: "evals/results/" },
        "dry-run": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (err) {
    throw new UsageError((err as Error).message);
  }
  const v = parsed.values;
  if (v.help) return "help";
  if (v.agent !== "claude" && v.agent !== "codex") throw new UsageError("--agent must be claude or codex");
  const posInt = (name: string, s: string | undefined): number | null => {
    if (s === undefined) return null;
    if (!/^\d+$/.test(s) || Number(s) < 1) throw new UsageError(`--${name} must be a positive integer`);
    return Number(s);
  };
  const conditions: Condition[] = [];
  if (v["with-skill"]) conditions.push("with-skill");
  if (v["without-skill"]) conditions.push("without-skill");
  return {
    agent: v.agent,
    casesFile: v.cases,
    conditions: conditions.length === 0 || conditions.length === 2 ? "both" : conditions,
    limit: posInt("limit", v.limit),
    only: v.only ?? null,
    model: v.model ?? null,
    timeoutS: posInt("timeout", v.timeout) ?? 180,
    outDir: v.out,
    dryRun: v["dry-run"],
  };
}

/** Paths that would leak the skill into a without-skill run. */
export function contamination(home: string): string[] {
  const hits: string[] = [];
  for (const p of [join(home, ".claude", "skills", "grep-first"), join(home, ".codex", "skills", "grep-first")]) {
    if (existsSync(p)) hits.push(p);
  }
  const agentsMd = join(home, ".codex", "AGENTS.md");
  if (existsSync(agentsMd) && readFileSync(agentsMd, "utf8").includes("grep-first")) hits.push(agentsMd);
  return hits;
}

export function selectCases(cases: Case[], only: string | null, limit: number | null): Case[] {
  const filtered = only === null ? cases : cases.filter((c) => c.id.startsWith(only));
  return limit === null ? filtered : filtered.slice(0, limit);
}

/** Both conditions alternate which one goes first, so neither always runs on a "cold" case. */
export function schedule(cases: Case[], conditions: Condition[] | "both"): { c: Case; condition: Condition }[] {
  return cases.flatMap((c, i) => {
    const conds: Condition[] =
      conditions === "both" ? (i % 2 === 0 ? ["with-skill", "without-skill"] : ["without-skill", "with-skill"]) : conditions;
    return conds.map((condition) => ({ c, condition }));
  });
}

const utcStamp = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");

function git(cwd: string, args: string[]): void {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "grep-first-eval",
      GIT_AUTHOR_EMAIL: "eval@example.invalid",
      GIT_COMMITTER_NAME: "grep-first-eval",
      GIT_COMMITTER_EMAIL: "eval@example.invalid",
    },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
}

function prepareWorkdir(workdir: string): void {
  cpSync(FIXTURE_DIR, workdir, { recursive: true });
  writeFileSync(join(workdir, ".gitignore"), "node_modules/\n");
  git(workdir, ["init", "-q"]);
  git(workdir, ["add", "-A"]);
  git(workdir, ["commit", "-q", "-m", "fixture"]);
}

function resetWorkdir(workdir: string): void {
  git(workdir, ["checkout", "-q", "--", "."]);
  git(workdir, ["clean", "-q", "-fd"]);
}

interface RawRecord {
  caseId: string;
  agent: AgentName;
  condition: Condition;
  answer: string;
  tokens: number | null;
  durationMs: number;
  score: Score | null;
  error?: string;
}

function runOne(inv: Invocation, timeoutS: number): { stdout: string; error?: string; durationMs: number } {
  const started = Date.now();
  const r = spawnSync(inv.cmd, inv.args, {
    cwd: inv.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutS * 1000,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;
  const stdout = r.stdout ?? "";
  if (r.error) {
    const timedOut = (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
    return { stdout, durationMs, error: timedOut ? `timeout after ${timeoutS}s` : r.error.message };
  }
  if (r.status !== 0) return { stdout, durationMs, error: `exit ${r.status}: ${(r.stderr ?? "").trim().slice(-500)}` };
  return { stdout, durationMs };
}

export function main(argv: string[]): number {
  let opts: RunOptions | "help";
  try {
    opts = parseCli(argv);
  } catch (err) {
    console.error(`error: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (opts === "help") {
    console.log(USAGE);
    return 0;
  }

  let cases: Case[];
  try {
    cases = selectCases(loadCases(resolve(opts.casesFile), FIXTURE_DIR), opts.only, opts.limit);
  } catch (err) {
    console.error(err instanceof CasesError ? err.message : `error: ${(err as Error).message}`);
    return 2;
  }
  if (cases.length === 0) {
    console.error("error: no cases left after --only/--limit");
    return 2;
  }

  const hits = contamination(homedir());
  if (hits.length > 0) {
    console.error(`contamination: grep-first is installed globally, so without-skill runs would see it:\n  ${hits.join("\n  ")}`);
    return 2;
  }

  const stamp = utcStamp(new Date());
  const skillText = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
  const plan = schedule(cases, opts.conditions);
  const model = opts.model ?? undefined;

  if (opts.agent === "claude") console.error(CLAUDE_EXEC_WARNING);

  if (opts.dryRun) {
    // Placeholder only: the real run creates an unpredictable name with mkdtemp.
    const workdir = join(tmpdir(), `grep-first-${stamp}-XXXXXX`);
    console.log(`workdir: ${workdir} (copy of ${relative(ROOT, FIXTURE_DIR)} incl. node_modules, git init + 1 commit)`);
    console.log(`with-skill: copy ${relative(ROOT, SKILL_DIR)}/ to ${SKILL_DIR_IN_WORKDIR}/, removed after each case`);
    for (const { c, condition } of plan) {
      const inv = buildArgv(opts.agent, condition, { prompt: c.prompt, workdir, model, skillText });
      console.log(JSON.stringify({ caseId: c.id, condition, cmd: inv.cmd, args: inv.args, cwd: inv.cwd, writeFiles: Object.keys(inv.writeFiles) }));
    }
    console.log(`dry-run: ${plan.length} runs planned, nothing spawned`);
    return 0;
  }

  const outDir = resolve(opts.outDir, `${stamp}-${opts.agent}`);
  mkdirSync(outDir, { recursive: true });
  const rawPath = join(outDir, "raw.jsonl");
  // mkdtemp: random suffix, mode 0700, fails instead of reusing a pre-created path in a shared tmp.
  const workdir = mkdtempSync(join(tmpdir(), `grep-first-${stamp}-`));
  const rows: Row[] = [];
  let failed = false;

  try {
    prepareWorkdir(workdir);
    for (const [i, { c, condition }] of plan.entries()) {
      const inv = buildArgv(opts.agent, condition, { prompt: c.prompt, workdir, model, skillText });
      if (condition === "with-skill") cpSync(SKILL_DIR, join(workdir, SKILL_DIR_IN_WORKDIR), { recursive: true });
      for (const [file, text] of Object.entries(inv.writeFiles)) writeFileSync(join(workdir, file), text);
      let res: ReturnType<typeof runOne>;
      try {
        res = runOne(inv, opts.timeoutS);
      } finally {
        for (const file of Object.keys(inv.writeFiles)) rmSync(join(workdir, file), { force: true });
        rmSync(join(workdir, SKILL_DIR_IN_WORKDIR), { recursive: true, force: true });
        resetWorkdir(workdir);
      }
      const parsed = parseOutput(opts.agent, res.stdout);
      const error = res.error ?? parsed.error;
      const score = error === undefined ? scoreAnswer(c, parsed.answer) : null;
      const rec: RawRecord = {
        caseId: c.id,
        agent: opts.agent,
        condition,
        answer: parsed.answer,
        tokens: parsed.tokens,
        durationMs: res.durationMs,
        score,
      };
      if (error !== undefined) {
        rec.error = error;
        failed = true;
      }
      appendFileSync(rawPath, `${JSON.stringify(rec)}\n`);
      rows.push({ caseId: c.id, agent: opts.agent, condition, kind: c.kind, outcome: score?.outcome ?? "error", tokens: parsed.tokens });
      console.log(`[${i + 1}/${plan.length}] ${c.id} ${condition}: ${score?.outcome ?? `error (${error})`}`);
    }
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }

  const report = renderReport({
    title: `grep-first eval: ${opts.agent}`,
    generatedAt: new Date().toISOString(),
    casesFile: relative(ROOT, resolve(opts.casesFile)),
    model: opts.model,
    metrics: aggregate(rows),
    rows,
  });
  writeFileSync(join(outDir, "report.md"), report);
  console.log(`\nwrote ${relative(process.cwd(), rawPath)} and ${relative(process.cwd(), join(outDir, "report.md"))}`);
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
