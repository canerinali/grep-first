import type { AgentName, Condition } from "./metrics.ts";

export const NEUTRAL_SUFFIX = "Answer with the code and a one-paragraph explanation.";
export const SKILL_PREFIX = "Skill files are in ./.grep-first/";
export const SKILL_DIR_IN_WORKDIR = ".grep-first";

export const CLAUDE_ALLOWED_TOOLS = [
  "Read",
  "Grep",
  "Glob",
  "Bash(grep:*)",
  "Bash(rg:*)",
  "Bash(ls:*)",
  "Bash(cat:*)",
  "Bash(find:*)",
  "Bash(node:*)",
  "Bash(python3:*)",
  "Bash(git:*)",
  "Bash(man:*)",
] as const;

export interface BuildOptions {
  /** The case prompt, without the neutral suffix. */
  prompt: string;
  workdir: string;
  model?: string;
  /** SKILL.md text; required for the with-skill condition. */
  skillText?: string;
}

export interface Invocation {
  cmd: string;
  args: string[];
  cwd: string;
  /** Files (relative to cwd) the runner writes before the case and deletes after it. */
  writeFiles: Record<string, string>;
}

export function buildPrompt(casePrompt: string): string {
  return `${casePrompt.trim()}\n\n${NEUTRAL_SUFFIX}`;
}

export function skillInjection(skillText: string): string {
  return `${SKILL_PREFIX}\n\n${skillText.trim()}\n`;
}

export function buildArgv(agent: AgentName, condition: Condition, opts: BuildOptions): Invocation {
  if (condition === "with-skill" && (opts.skillText === undefined || opts.skillText.trim() === "")) {
    throw new Error("with-skill needs skillText");
  }
  const prompt = buildPrompt(opts.prompt);
  const withSkill = condition === "with-skill";
  if (agent === "claude") {
    const args = ["-p", prompt, "--output-format", "json", "--disable-slash-commands"];
    if (withSkill) args.push("--append-system-prompt", skillInjection(opts.skillText!));
    args.push("--allowedTools", ...CLAUDE_ALLOWED_TOOLS);
    if (opts.model) args.push("--model", opts.model);
    return { cmd: "claude", args, cwd: opts.workdir, writeFiles: {} };
  }
  const args = ["exec", "--json", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", opts.workdir];
  if (opts.model) args.push("-m", opts.model);
  args.push(prompt);
  return {
    cmd: "codex",
    args,
    cwd: opts.workdir,
    writeFiles: withSkill ? { "AGENTS.md": skillInjection(opts.skillText!) } : {},
  };
}

export interface ParsedOutput {
  answer: string;
  tokens: number | null;
  /** Set when the agent reported a failure inside its own output. */
  error?: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Claude: total tokens = input + cache creation + cache read + output (Claude reports cache separately).
 * Codex: total tokens = input + output (Codex input_tokens already includes cached_input_tokens).
 * Unknown shapes return tokens: null and never throw.
 */
export function parseOutput(agent: AgentName, stdout: string): ParsedOutput {
  return agent === "claude" ? parseClaude(stdout) : parseCodex(stdout);
}

function parseClaude(stdout: string): ParsedOutput {
  const trimmed = stdout.trim();
  let data = tryJson(trimmed);
  if (data === undefined) {
    const lastLine = trimmed.split("\n").filter((l) => l.trim() !== "").pop() ?? "";
    data = tryJson(lastLine);
  }
  if (Array.isArray(data)) data = [...data].reverse().find((e) => isObj(e) && e.type === "result");
  if (!isObj(data)) return { answer: trimmed, tokens: null };
  const answer = typeof data.result === "string" ? data.result : "";
  const u = data.usage;
  const tokens = isObj(u)
    ? n(u.input_tokens) + n(u.cache_creation_input_tokens) + n(u.cache_read_input_tokens) + n(u.output_tokens)
    : null;
  const out: ParsedOutput = { answer, tokens };
  if (data.is_error === true) out.error = answer || String(data.subtype ?? "claude reported an error");
  return out;
}

function parseCodex(stdout: string): ParsedOutput {
  let answer = "";
  let tokens: number | null = null;
  let error: string | undefined;
  for (const line of stdout.split("\n")) {
    const ev = tryJson(line.trim());
    if (!isObj(ev)) continue;
    const item = ev.item;
    if (ev.type === "item.completed" && isObj(item) && item.type === "agent_message" && typeof item.text === "string") {
      answer = item.text;
    }
    if (ev.type === "turn.completed" && isObj(ev.usage)) {
      tokens = n(ev.usage.input_tokens) + n(ev.usage.output_tokens);
    }
    if (ev.type === "turn.failed" || ev.type === "error") {
      const e = ev.error;
      error = isObj(e) && typeof e.message === "string" ? e.message : typeof ev.message === "string" ? ev.message : "codex reported an error";
    }
  }
  const out: ParsedOutput = { answer, tokens };
  if (error !== undefined) out.error = error;
  return out;
}
