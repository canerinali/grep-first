import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const MAX_LINES = 60;
export const RULE_COUNT = 8;
export const MAX_DESCRIPTION = 1024;
export const DEFAULT_SKILL_PATH = "skills/grep-first/SKILL.md";

export interface LintProblem {
  line: number;
  message: string;
}

export interface LintResult {
  problems: LintProblem[];
  lines: number;
  rules: number;
}

const RULE_RE = /^(\d+)\.\s/;
const FENCE_RE = /^\s*(```|~~~)/;

export function lintSkill(text: string): LintResult {
  const problems: LintProblem[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");

  if (lines.length > MAX_LINES) {
    problems.push({ line: MAX_LINES + 1, message: `file has ${lines.length} lines, limit is ${MAX_LINES}` });
  }

  let bodyStart = 0;
  if (lines[0] !== "---") {
    problems.push({ line: 1, message: "missing frontmatter (first line must be ---)" });
  } else {
    const close = lines.indexOf("---", 1);
    if (close === -1) {
      problems.push({ line: 1, message: "frontmatter is not closed with ---" });
    } else {
      bodyStart = close + 1;
      let data: unknown;
      try {
        data = parse(lines.slice(1, close).join("\n"));
      } catch (err) {
        problems.push({ line: 2, message: `frontmatter is not valid YAML: ${(err as Error).message.split("\n")[0]}` });
      }
      const fm = (data ?? {}) as Record<string, unknown>;
      const nameLine = lines.findIndex((l, i) => i > 0 && i < close && l.startsWith("name:")) + 1 || 2;
      const descLine = lines.findIndex((l, i) => i > 0 && i < close && l.startsWith("description:")) + 1 || 2;
      if (data !== undefined && fm.name !== "grep-first") {
        problems.push({ line: nameLine, message: "frontmatter must contain name: grep-first" });
      }
      const desc = fm.description;
      if (data !== undefined && (typeof desc !== "string" || desc.trim() === "")) {
        problems.push({ line: descLine, message: "frontmatter description is missing or empty" });
      } else if (typeof desc === "string" && desc.length > MAX_DESCRIPTION) {
        problems.push({ line: descLine, message: `description is ${desc.length} chars, limit is ${MAX_DESCRIPTION}` });
      }
    }
  }

  const rules: { n: number; line: number }[] = [];
  let inFence = false;
  for (let i = bodyStart; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (FENCE_RE.test(l)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = RULE_RE.exec(l);
    if (m) rules.push({ n: Number(m[1]), line: i + 1 });
  }
  if (rules.length !== RULE_COUNT) {
    problems.push({
      line: rules[0]?.line ?? bodyStart + 1,
      message: `found ${rules.length} numbered rules outside code fences, expected ${RULE_COUNT}`,
    });
  }
  rules.forEach((r, idx) => {
    if (idx < RULE_COUNT && r.n !== idx + 1) {
      problems.push({ line: r.line, message: `rule numbered ${r.n}, expected ${idx + 1}` });
    }
  });

  return { problems, lines: lines.length, rules: rules.length };
}

function main(): void {
  const path = process.argv[2] ?? DEFAULT_SKILL_PATH;
  const result = lintSkill(readFileSync(path, "utf8"));
  if (result.problems.length > 0) {
    for (const p of result.problems) console.error(`${path}:${p.line}: ${p.message}`);
    process.exit(1);
  }
  console.log(`ok: ${result.lines} lines, ${result.rules} rules`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
