import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintSkill } from "../scripts/lint-skill.ts";

const fx = (name: string) => readFileSync(`test/fixtures/skill/${name}`, "utf8");

describe("lintSkill", () => {
  it("accepts the shipped SKILL.md", () => {
    const r = lintSkill(readFileSync("skills/grep-first/SKILL.md", "utf8"));
    expect(r.problems).toEqual([]);
    expect(r.rules).toBe(8);
    expect(r.lines).toBeLessThanOrEqual(60);
  });

  it("accepts the valid fixture", () => {
    expect(lintSkill(fx("valid.md")).problems).toEqual([]);
  });

  const bad: [string, RegExp][] = [
    ["too-long-61.md", /61 lines, limit is 60/],
    ["seven-rules.md", /found 7 numbered rules/],
    ["nine-rules.md", /found 9 numbered rules/],
    ["numbering-gap.md", /rule numbered 6, expected 5/],
    ["rule-in-fence.md", /found 7 numbered rules outside code fences/],
    ["no-frontmatter.md", /missing frontmatter/],
  ];
  for (const [file, re] of bad) {
    it(`rejects ${file}`, () => {
      const msgs = lintSkill(fx(file)).problems.map((p) => p.message);
      expect(msgs.some((m) => re.test(m))).toBe(true);
    });
  }

  it("rejects wrong name, empty description and too-long description", () => {
    const base = fx("valid.md");
    const wrongName = base.replace("name: grep-first", "name: other");
    expect(lintSkill(wrongName).problems.map((p) => p.message)).toContain("frontmatter must contain name: grep-first");
    const empty = base.replace(/^description: .*$/m, 'description: ""');
    expect(lintSkill(empty).problems.map((p) => p.message)).toContain("frontmatter description is missing or empty");
    const long = base.replace(/^description: .*$/m, `description: ${"x".repeat(1025)}`);
    expect(lintSkill(long).problems.some((p) => /1025 chars/.test(p.message))).toBe(true);
  });

  it("CLI prints ok for the real skill and file:line for a bad one", () => {
    const ok = execFileSync("npx", ["tsx", "scripts/lint-skill.ts"], { encoding: "utf8" });
    expect(ok).toMatch(/^ok: \d+ lines, 8 rules/);
    const badRun = spawnSync("npx", ["tsx", "scripts/lint-skill.ts", "test/fixtures/skill/seven-rules.md"], { encoding: "utf8" });
    expect(badRun.status).toBe(1);
    expect(badRun.stderr).toMatch(/^test\/fixtures\/skill\/seven-rules\.md:\d+: /m);
  });
});
