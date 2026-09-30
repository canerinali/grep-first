import { describe, expect, it } from "vitest";
import { brokenLinksIn, checkLinks, isExternal } from "../scripts/check-links.ts";

describe("check-links", () => {
  it("treats URLs and anchors as external", () => {
    expect(isExternal("https://x.dev")).toBe(true);
    expect(isExternal("mailto:a@b.c")).toBe(true);
    expect(isExternal("#section")).toBe(true);
    expect(isExternal("docs/a.md")).toBe(false);
  });

  it("passes a tree whose relative links resolve, ignoring fenced and inline code", () => {
    const r = checkLinks("test/fixtures/links");
    expect(r.files).toBe(2);
    expect(r.broken).toEqual([]);
  });

  it("reports file and line for a broken link", () => {
    const r = checkLinks("test/fixtures/links-broken");
    expect(r.broken).toHaveLength(1);
    expect(r.broken[0]).toMatchObject({ line: 3, target: "nope/missing.md" });
  });

  it("strips anchors before resolving", () => {
    expect(brokenLinksIn("test/fixtures/links/ok.md", "[a](sub/target.md#frag)")).toEqual([]);
  });

  it("finds no broken links in the repository", () => {
    expect(checkLinks(".").broken).toEqual([]);
  });
});
