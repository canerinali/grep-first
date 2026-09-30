import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("examples/verify-symbol.sh", () => {
  it("exits 0 and verifies the real symbols while flagging the invented ones", () => {
    const r = spawnSync("bash", ["examples/verify-symbol.sh"], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/^Verified: Model\.findOneAndUpdate {2}node_modules\/mongoose\/types\/models\.d\.ts:\d+ {2}findOneAndUpdate/m);
    expect(r.stdout).toMatch(/^Unverified: Model\.findOneAndUpsert /m);
    expect(r.stdout).toMatch(/^Verified: git log --no-merges /m);
    expect(r.stdout).toMatch(/^Unverified: git log --since-commit=HEAD /m);
  });
});
