import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildArgv, CLAUDE_ALLOWED_TOOLS, NEUTRAL_SUFFIX, parseOutput, SKILL_PREFIX } from "../evals/lib/agents.ts";
import { schedule, selectCases } from "../evals/run.ts";
import { loadCases } from "../evals/lib/schema.ts";

const W = "/tmp/grep-first-test";
const P = "Using X.y, write z.";
const FULL = `${P}\n\n${NEUTRAL_SUFFIX}`;
const SKILL = "---\nname: grep-first\n---\nrules";
const INJECTED = `${SKILL_PREFIX}\n\n${SKILL}\n`;

// Flags pinned below were checked against local `claude --help` and `codex exec --help` (codex-cli 0.157.1).
describe("buildArgv", () => {
  it("claude without-skill", () => {
    expect(buildArgv("claude", "without-skill", { prompt: P, workdir: W })).toEqual({
      cmd: "claude",
      args: ["-p", FULL, "--output-format", "json", "--disable-slash-commands", "--allowedTools", ...CLAUDE_ALLOWED_TOOLS],
      cwd: W,
      writeFiles: {},
    });
  });

  it("claude with-skill and model", () => {
    expect(buildArgv("claude", "with-skill", { prompt: P, workdir: W, model: "sonnet", skillText: SKILL })).toEqual({
      cmd: "claude",
      args: [
        "-p", FULL, "--output-format", "json", "--disable-slash-commands",
        "--append-system-prompt", INJECTED,
        "--allowedTools", "Read", "Grep", "Glob", "Bash(grep:*)", "Bash(rg:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(find:*)",
        "Bash(node:*)", "Bash(python3:*)", "Bash(git:*)", "Bash(man:*)",
        "--model", "sonnet",
      ],
      cwd: W,
      writeFiles: {},
    });
  });

  it("codex without-skill", () => {
    expect(buildArgv("codex", "without-skill", { prompt: P, workdir: W })).toEqual({
      cmd: "codex",
      args: ["exec", "--json", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", W, FULL],
      cwd: W,
      writeFiles: {},
    });
  });

  it("codex with-skill writes AGENTS.md and passes the model", () => {
    expect(buildArgv("codex", "with-skill", { prompt: P, workdir: W, model: "gpt-5.5", skillText: SKILL })).toEqual({
      cmd: "codex",
      args: ["exec", "--json", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", W, "-m", "gpt-5.5", FULL],
      cwd: W,
      writeFiles: { "AGENTS.md": INJECTED },
    });
  });

  it("no case prompt or the suffix mentions verification", () => {
    expect(NEUTRAL_SUFFIX).not.toMatch(/verif|evidence|source|grep/i);
    for (const c of loadCases("evals/cases.yaml", "evals/fixture")) {
      expect(buildArgv("codex", "without-skill", { prompt: c.prompt, workdir: W }).args.at(-1)).not.toMatch(/verif|evidence|grep-first/i);
    }
  });

  it("with-skill without skill text throws", () => {
    expect(() => buildArgv("claude", "with-skill", { prompt: P, workdir: W })).toThrow(/skillText/);
  });
});

describe("parseOutput (synthetic outputs)", () => {
  it("claude JSON result + usage", () => {
    const out = parseOutput("claude", readFileSync("test/fixtures/agents/synthetic-claude-result.json", "utf8"));
    expect(out.answer).toMatch(/^Unverified: Model.findOneAndUpsert/);
    expect(out.tokens).toBe(12 + 3000 + 9000 + 250);
    expect(out.error).toBeUndefined();
  });

  it("claude is_error is surfaced", () => {
    const out = parseOutput("claude", JSON.stringify({ type: "result", subtype: "error_max_turns", is_error: true, usage: { input_tokens: 5, output_tokens: 1 } }));
    expect(out).toEqual({ answer: "", tokens: 6, error: "error_max_turns" });
  });

  it("codex JSONL final agent message + last usage", () => {
    const out = parseOutput("codex", readFileSync("test/fixtures/agents/synthetic-codex-events.jsonl", "utf8"));
    expect(out.answer).toBe("Unverified: Model.findOneAndUpsert. Use findOneAndUpdate(filter, update, { upsert: true }).");
    expect(out.tokens).toBe(14296 + 6);
  });

  it("codex turn.failed is surfaced", () => {
    const out = parseOutput("codex", '{"type":"turn.failed","error":{"message":"rate limited"}}\n');
    expect(out).toEqual({ answer: "", tokens: null, error: "rate limited" });
  });

  it.each([
    ["claude", "not json at all"],
    ["claude", '{"unexpected": true}'],
    ["claude", "[1,2,3]"],
    ["codex", "garbage\n{\"type\":\"turn.completed\"}\n"],
    ["codex", ""],
  ] as const)("unknown %s shape gives tokens null and does not throw", (agent, stdout) => {
    expect(parseOutput(agent, stdout).tokens).toBeNull();
  });
});

describe("schedule and selection", () => {
  const cases = loadCases("evals/cases.yaml", "evals/fixture");
  it("alternates condition order per case when running both", () => {
    const plan = schedule(cases.slice(0, 2), "both").map((p) => `${p.c.id}:${p.condition}`);
    expect(plan).toEqual([
      `${cases[0]!.id}:with-skill`,
      `${cases[0]!.id}:without-skill`,
      `${cases[1]!.id}:without-skill`,
      `${cases[1]!.id}:with-skill`,
    ]);
  });
  it("--only then --limit", () => {
    expect(selectCases(cases, "mongoose-", 2).map((c) => c.id)).toEqual(["mongoose-findOneAndUpsert", "mongoose-findOrCreate"]);
  });
});

describe("run.ts CLI", () => {
  const tmp = mkdtempSync(join(tmpdir(), "grep-first-cli-test-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  // Fake claude/codex binaries that leave a marker if anything spawns them.
  const bin = join(tmp, "bin");
  const marker = join(tmp, "spawned");
  mkdirSync(bin);
  for (const name of ["claude", "codex"]) {
    writeFileSync(join(bin, name), `#!/bin/sh\ntouch "${marker}"\n`);
    chmodSync(join(bin, name), 0o755);
  }

  const run = (args: string[], home: string) =>
    spawnSync(process.execPath, ["--import", "tsx", resolve("evals/run.ts"), ...args], {
      encoding: "utf8",
      env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH ?? ""}` },
    });

  const cleanHome = join(tmp, "home-clean");
  mkdirSync(cleanHome);

  it("--dry-run prints argv JSON for each run and spawns nothing", () => {
    const r = run(["--agent", "claude", "--limit", "2", "--dry-run"], cleanHome);
    expect(r.status).toBe(0);
    const argvLines = r.stdout.split("\n").filter((l) => l.startsWith("{"));
    expect(argvLines).toHaveLength(4);
    const first = JSON.parse(argvLines[0]!) as { cmd: string; args: string[]; condition: string };
    expect(first.cmd).toBe("claude");
    expect(first.condition).toBe("with-skill");
    expect(first.args).toContain("--append-system-prompt");
    expect(r.stdout).toMatch(/dry-run: 4 runs planned, nothing spawned/);
    expect(existsSync(marker)).toBe(false);
  });

  it("contamination guard exits 2 when the skill is installed for Claude", () => {
    const home = join(tmp, "home-claude");
    mkdirSync(join(home, ".claude", "skills", "grep-first"), { recursive: true });
    const r = run(["--agent", "claude", "--dry-run"], home);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/contamination/);
  });

  it("contamination guard exits 2 when ~/.codex/AGENTS.md mentions grep-first", () => {
    const home = join(tmp, "home-codex");
    mkdirSync(join(home, ".codex"), { recursive: true });
    writeFileSync(join(home, ".codex", "AGENTS.md"), "# rules\nSee grep-first.\n");
    const r = run(["--agent", "codex", "--dry-run"], home);
    expect(r.status).toBe(2);
    expect(existsSync(marker)).toBe(false);
  });

  it("bad args exit 2", () => {
    expect(run(["--agent", "gemini"], cleanHome).status).toBe(2);
    expect(run(["--agent", "claude", "--limit", "zero"], cleanHome).status).toBe(2);
    expect(run(["--agent", "claude", "--bogus"], cleanHome).status).toBe(2);
    expect(run(["--agent", "claude", "--only", "nomatch-", "--dry-run"], cleanHome).status).toBe(2);
  });

  it("bad cases file exits 2", () => {
    const bad = join(tmp, "bad.yaml");
    writeFileSync(bad, "- id: only-one\n  kind: trap\n");
    expect(run(["--agent", "claude", "--cases", bad, "--dry-run"], cleanHome).status).toBe(2);
  });
});
