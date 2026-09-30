import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export interface BrokenLink {
  file: string;
  line: number;
  target: string;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "coverage"]);
const LINK_RE = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const FENCE_RE = /^\s*(```|~~~)/;

export function listMarkdown(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      // test/fixtures holds deliberately broken Markdown for the tests.
      if (relative(root, full).split(sep).join("/") === "test/fixtures") continue;
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

export function isExternal(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#") || target.startsWith("//");
}

export function brokenLinksIn(file: string, text: string): BrokenLink[] {
  const broken: BrokenLink[] = [];
  let inFence = false;
  text.split("\n").forEach((line, i) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const noCode = line.replace(/`[^`]*`/g, "");
    for (const m of noCode.matchAll(LINK_RE)) {
      const target = m[1] ?? "";
      if (target === "" || isExternal(target)) continue;
      const pathPart = decodeURIComponent(target.split("#")[0] ?? "");
      if (pathPart === "") continue;
      if (!existsSync(resolve(dirname(file), pathPart))) broken.push({ file, line: i + 1, target });
    }
  });
  return broken;
}

export function checkLinks(root: string): { files: number; broken: BrokenLink[] } {
  const files = listMarkdown(root);
  const broken = files.flatMap((f) => brokenLinksIn(f, readFileSync(f, "utf8")));
  return { files: files.length, broken };
}

function main(): void {
  const root = resolve(process.argv[2] ?? ".");
  const { files, broken } = checkLinks(root);
  for (const b of broken) console.error(`${relative(root, b.file)}:${b.line}: broken link ${b.target}`);
  if (broken.length > 0) process.exit(1);
  console.log(`ok: ${files} markdown files, all relative links resolve`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
