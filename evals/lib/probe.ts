import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { Probe } from "./schema.ts";

export interface ProbeResult {
  pass: boolean;
  detail: string;
}

const ENV = { ...process.env, LC_ALL: "C", LANG: "C" };

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = ENV) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8", timeout: 30_000 });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  return r;
}

function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name !== "node_modules") walk(full);
      } else if (exts.some((e) => name.endsWith(e)) && !(exts.includes(".js") && name.endsWith(".d.ts"))) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort();
}

function grepPackage(fixtureDir: string, pkg: string, pattern: string, exts: string[]): ProbeResult {
  const re = new RegExp(pattern);
  const root = join(fixtureDir, "node_modules", pkg);
  for (const file of listFiles(root, exts)) {
    const lines = readFileSync(file, "utf8").split("\n");
    const idx = lines.findIndex((l) => re.test(l));
    if (idx !== -1) return { pass: true, detail: `${relative(fixtureDir, file)}:${idx + 1}` };
  }
  return { pass: false, detail: `no match for /${pattern}/ in ${relative(fixtureDir, root)} (${exts.join(",")})` };
}

const NODE_MEMBER = `
const [pkg, path] = process.argv.slice(1);
let v = require(pkg);
for (const seg of path.split(".")) { v = v == null ? undefined : v[seg]; }
process.stdout.write(typeof v);
`;

const PY_ATTR = `
import importlib, sys
v = importlib.import_module(sys.argv[1])
for seg in sys.argv[2].split("."):
    if not hasattr(v, seg):
        print("missing"); sys.exit(0)
    v = getattr(v, seg)
print(type(v).__name__)
`;

export function withTempGitRepo<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "grep-first-probe-"));
  try {
    const env = gitEnv();
    run("git", ["init", "-q"], dir, env);
    run("git", ["commit", "-q", "--allow-empty", "-m", "init"], dir, env);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...ENV,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "probe",
    GIT_AUTHOR_EMAIL: "probe@example.invalid",
    GIT_COMMITTER_NAME: "probe",
    GIT_COMMITTER_EMAIL: "probe@example.invalid",
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function runProbe(probe: Probe, fixtureDir: string): ProbeResult {
  switch (probe.type) {
    case "node-member": {
      const r = run("node", ["-e", NODE_MEMBER, probe.package, probe.path], fixtureDir);
      if (r.status !== 0) return { pass: false, detail: `node exited ${r.status}: ${r.stderr.trim().split("\n")[0]}` };
      return { pass: r.stdout !== "undefined", detail: `typeof ${probe.package}.${probe.path} = ${r.stdout}` };
    }
    case "dts-grep":
      return grepPackage(fixtureDir, probe.package, probe.pattern, [".d.ts", ".d.cts", ".d.mts"]);
    case "source-grep":
      return grepPackage(fixtureDir, probe.package, probe.pattern, [".js", ".cjs", ".mjs"]);
    case "python-attr": {
      const r = run("python3", ["-c", PY_ATTR, probe.module, probe.path], fixtureDir);
      if (r.status !== 0) return { pass: false, detail: `python3 exited ${r.status}: ${r.stderr.trim().split("\n").pop()}` };
      const out = r.stdout.trim();
      return { pass: out !== "missing", detail: `${probe.module}.${probe.path}: ${out}` };
    }
    case "cli-help": {
      const [cmd, ...args] = probe.cmd as [string, ...string[]];
      const r = run(cmd, args, fixtureDir);
      const text = `${r.stdout}\n${r.stderr}`;
      const re = new RegExp(`${escapeRe(probe.flag)}(?![\\w-])`);
      const idx = text.split("\n").findIndex((l) => re.test(l));
      return idx === -1
        ? { pass: false, detail: `${probe.cmd.join(" ")}: no line mentions ${probe.flag}` }
        : { pass: true, detail: `${probe.cmd.join(" ")}: line ${idx + 1}` };
    }
    case "cli-exit": {
      const [cmd, ...args] = probe.cmd as [string, ...string[]];
      return withTempGitRepo((dir) => {
        const r = run(cmd, args, dir, gitEnv());
        const first = `${r.stderr}`.trim().split("\n")[0] ?? "";
        return { pass: r.status === 0, detail: `${probe.cmd.join(" ")} exited ${r.status}${first ? `: ${first}` : ""}` };
      });
    }
  }
}
