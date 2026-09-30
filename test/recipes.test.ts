import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REF_DIR = "skills/grep-first/references";
const FIXTURE = resolve("evals/fixture");
const BLOCK_RE = /^```sh example\n([\s\S]*?)^```/gm;

export function exampleBlocks(markdown: string): string[] {
  return [...markdown.matchAll(BLOCK_RE)].map((m) => m[1] ?? "");
}

const files = readdirSync(REF_DIR).filter((f) => f.endsWith(".md")).sort();

describe("reference recipes", () => {
  it("has the four reference files", () => {
    expect(files).toEqual(["cli.md", "mongoose.md", "node.md", "python.md"]);
  });

  for (const file of files) {
    const blocks = exampleBlocks(readFileSync(join(REF_DIR, file), "utf8"));
    it(`${file} has at least 2 runnable examples`, () => {
      expect(blocks.length).toBeGreaterThanOrEqual(2);
    });
    blocks.forEach((block, i) => {
      it(`${file} example ${i + 1} exits 0 with output in evals/fixture`, () => {
        const r = spawnSync("sh", ["-c", block], {
          cwd: FIXTURE,
          encoding: "utf8",
          env: { ...process.env, LC_ALL: "C" },
          timeout: 30_000,
        });
        expect(r.status, `stderr: ${r.stderr}`).toBe(0);
        expect(r.stdout.trim().length).toBeGreaterThan(0);
      });
    });
  }
});
