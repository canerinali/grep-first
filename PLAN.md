# grep-first v0.1 Build Plan

> Scope contract: one day, one agent. No TODOs and no "v0.2 hooks" in code. MIT.
> Nothing is published to npm. The repo ships a skill (Markdown) plus a dev-only eval harness.
> Node >= 22, Python >= 3.12 (stdlib only), git >= 2.40. Dev deps only: `yaml`, `tsx`, `typescript`, `vitest`, `@types/node`.

## 1. Value proposition

grep-first is one SKILL.md for Claude Code, Codex and any other SKILL.md/AGENTS.md agent. Before the agent uses an external method, CLI flag or config/env key, the skill makes it find that symbol in the locally installed source and show where it is defined (`file:line` + signature). If it can't find the symbol, it has to say "unverified" instead of making something up.

Positioning: other tools work from docs (addyosmani source-driven-development) or check after the code is written (Rune hallucination-guard). grep-first checks **before writing, against local installed source, with an evidence line**. It targets what type checkers miss: CLI flags, config/env keys, dynamic JS/Python, mongoose prototype methods.

## 2. Not in MVP

- No PreToolUse hook or any other hook. No MCP server, no plugin manifest.
- No npm publish, no `bin`, no installer script. Installing means copying a directory (§6).
- No automatic evidence checking. The scorer does not open the cited `file:line`, so made-up evidence on a trap still scores as hallucinated.
- No test of whether the skill auto-triggers. The runner always injects the skill text (§5.2), so it measures the rules, not skill discovery.
- No agents other than `claude -p` and `codex exec`. No parallel runs, no repeats/variance, no cost in USD (tokens only).
- No languages beyond Node/TS, Python stdlib, and the `git`/`node` CLIs. No third-party pip packages.
- No external link checking. CI checks relative Markdown links only (no network).
- No demo GIF in the repo. README has a written 20-second demo script; a human records the GIF later.
- README contains no benchmark numbers unless they are pasted verbatim from a runner report (§8).

## 3. File / module layout

```
skills/grep-first/
  SKILL.md                 # <= 60 lines, frontmatter + exactly 8 numbered rules
  references/
    node.md                # node_modules/<pkg>/**/*.d.ts, "exports" map, re-export chains, runtime probe
    python.md              # python3 -c "import x, inspect; ...", site-packages lookup
    cli.md                 # LC_ALL=C <cmd> --help | grep -n -- '--flag', man -P cat, git help -a
    mongoose.md            # prototype/static methods: types/*.d.ts + Model.prototype runtime check
evals/
  cases.yaml               # 20 trap + 10 valid cases (§7)
  fixture/                 # separate npm project; agents run in a temp COPY of it
    package.json           # devDependencies: mongoose, commander, dotenv, yaml (exact pins)
    package-lock.json
    src/app.ts             # ~15 lines importing all four packages
  lib/
    schema.ts              # hand-written validator for cases.yaml -> Case[]
    probe.ts               # runs one case probe against evals/fixture (impure)
    score.ts               # PURE: scoreAnswer(case, answerText) -> Score
    metrics.ts             # PURE: aggregate(Score[]) -> Metrics per agent x condition
    agents.ts              # PURE buildArgv(agent, condition, opts) + parseOutput(agent, stdout)
    report.ts              # PURE: Metrics + rows -> Markdown table
  run.ts                   # CLI entry (node:util parseArgs)
  verify-cases.ts          # every trap probe must FAIL, every valid probe must PASS
  results/                 # gitignored except results that README cites
scripts/
  lint-skill.ts            # §6.1
  check-links.ts           # relative links in *.md resolve to existing files
test/
  score/metrics/schema/agents/lint-skill/links/recipes/readme .test.ts
  fixtures/                # bad SKILL.md variants, synthetic agent outputs (marked "synthetic")
.github/workflows/ci.yml
README.md  LICENSE  package.json  tsconfig.json  .gitignore
```

## 4. Tech choices

- **TypeScript on Node 22 via `tsx`**: dev tooling that is never built or published; `typescript` only for `tsc --noEmit`.
- **`yaml`**: cases must be readable and allow comments explaining each trap.
- **`vitest`**: fast, runs TS natively, same stack as rig-replay.
- **No `commander`/`zod` at the root**: `node:util` `parseArgs` and a ~60-line hand-written validator suffice. (commander is installed only inside `evals/fixture` as a subject under test.)
- **Fixture packages** (exact versions via `npm install --save-exact`): `mongoose` (prototype/static/Query methods, schema options, `mongoose.set` keys), `commander` (builder API; hard-but-valid methods), `dotenv` (env keys read in JS, not declared in `.d.ts`), `yaml` (re-export chain). Python stdlib only, plus `git` and `node` CLIs.

## 5. Eval runner

### 5.1 CLI

```
npx tsx evals/run.ts --agent claude --cases evals/cases.yaml --with-skill --limit 5 --dry-run
npx tsx evals/run.ts --agent codex --without-skill --only mongoose-
npx tsx evals/run.ts --agent claude            # neither flag = both conditions, alternating per case
npx tsx evals/run.ts --agent claude --model sonnet --timeout 180 --out evals/results/
npx tsx evals/verify-cases.ts                  # ground-truth check, no agent involved
```

| Flag | Default | Meaning |
|---|---|---|
| `--agent claude\|codex` | required | which CLI to call |
| `--cases <file>` | `evals/cases.yaml` | case file |
| `--with-skill` / `--without-skill` | both | condition(s) to run |
| `--limit N` | all | first N cases after `--only` filtering |
| `--only <prefix>` | none | filter by case id prefix |
| `--model <m>` | agent default | passed through |
| `--timeout <s>` | 180 | per-case kill timeout |
| `--out <dir>` | `evals/results/` | writes `<UTC-stamp>-<agent>/{raw.jsonl,report.md}` |
| `--dry-run` | off | print each argv (JSON) and workdir plan; spawn nothing |

Exit codes: 0 ok, 1 a case run failed (recorded as `error`), 2 bad args / bad cases file / contamination detected.

### 5.2 How each run works

1. Validate `cases.yaml`. Copy `evals/fixture` (incl. `node_modules`) to `os.tmpdir()/grep-first-<stamp>/`, `git init` + one commit. The agent never sees `cases.yaml`.
2. Contamination guard: exit 2 if `~/.claude/skills/grep-first`, `~/.codex/skills/grep-first`, or a `~/.codex/AGENTS.md` containing "grep-first" exists.
3. With-skill: copy `skills/grep-first/` to `<workdir>/.grep-first/`. Claude: SKILL.md text via `--append-system-prompt` preceded by "Skill files are in ./.grep-first/". Codex: write the same text to `<workdir>/AGENTS.md`, delete after the case. Without-skill: neither.
4. Argv (pure `buildArgv`, no shell):
   - Claude: `claude -p <prompt> --output-format json --disable-slash-commands --allowedTools Read Grep Glob "Bash(grep:*)" "Bash(rg:*)" "Bash(ls:*)" "Bash(cat:*)" "Bash(find:*)" "Bash(node:*)" "Bash(python3:*)" "Bash(git:*)" "Bash(man:*)" [--model m]`, cwd = workdir.
   - Codex: `codex exec --json --ephemeral --sandbox read-only --skip-git-repo-check -C <workdir> [-m m] <prompt>`, stdin = /dev/null.
   - Confirm flags from local `--help` before pinning them in `agents.test.ts`.
5. Prompt = `case.prompt` + neutral suffix "Answer with the code and a one-paragraph explanation." (never mentions verification).
6. `parseOutput`: Claude JSON `result` + `usage`; Codex JSONL final agent message + last `usage`. Unknown shapes give `tokens: null`, never throw.
7. Append `{caseId, agent, condition, answer, tokens, durationMs, score}` to `raw.jsonl`, then write `report.md`.

### 5.3 Scoring (pure, `evals/lib/score.ts`)

`scoreAnswer(c, answer) -> { outcome, flagged, evidence: string[], mentionsSymbol }`, outcome ∈ `hallucinated | verified-with-evidence | used-without-evidence | marked-unverified | unclear`.

- `leaf` = last segment of `c.symbol`; `mentionsSymbol` = answer contains `leaf`.
- `flagged` = a line starting with `Unverified`/`**Unverified**`, or a line containing `leaf` matching FLAG regex (`unverified`, `not verified`, `could(n't| not) (find|verify)`, `does(n't| not) exist`, `no such`, `there is no`, `is not a (valid|real)`, `unknown (option|flag|method)`). Plain "not found" excluded.
- `evidence` = `path.ext:line` matches (`.d.ts|.ts|.js|.cjs|.mjs|.py|.pyi`) plus `c.evidence_pattern` if set.
- Order: flagged → `marked-unverified`; !mentionsSymbol → `unclear`; trap → `hallucinated`; else evidence ? `verified-with-evidence` : `used-without-evidence`.

`metrics.ts` per agent × condition: hallucination rate (hallucinated / traps), false-unverified rate (marked-unverified / valid), evidence rate (verified-with-evidence / valid), mean tokens, token delta (paired non-null only). `unclear` and `error` shown but excluded from denominators.

## 6. Skill, install, lint

Frontmatter: `name: grep-first`, `description` ≤ 1024 chars triggering on "using an external library method, CLI flag, config or env key". 8 rules in order:

1. Find the definition in installed source before using a new external symbol.
2. Read the version from the lockfile and the installed `package.json`.
3. For CLI flags, check `<cmd> --help` / `man` first.
4. For config/env keys, find the schema or the code that reads the key.
5. Show evidence as `file:line` + signature.
6. If nothing is found, write `Unverified: <symbol>` (searched where) and suggest an alternative.
7. Apply only to *new* and *external* symbols.
8. Use the type checker/LSP first when one is available.

Plus a 3-line output example and links to `references/*.md`.

Install (README): clone + `cp -r skills/grep-first ~/.claude/skills/` (Claude Code), `~/.codex/skills/` (Codex), or append SKILL.md to `AGENTS.md`.

### 6.1 `scripts/lint-skill.ts [path]`

Exit 1 with `file:line: message` if: > 60 lines (incl. frontmatter); frontmatter missing / no `name: grep-first` / empty or too-long `description`; count of `^\d+\.\s` lines outside code fences ≠ 8; numbers not 1..8 in order. Prints `ok: N lines, 8 rules`. `check-links.ts` resolves relative links in all `*.md` outside `node_modules`.

## 7. `evals/cases.yaml`

```yaml
- id: mongoose-findOneAndUpsert
  kind: trap                           # trap | valid
  domain: node                         # node | python | cli | config
  symbol: Model.findOneAndUpsert
  prompt: "Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."
  probe: { type: node-member, package: mongoose, path: Model.findOneAndUpsert }
  why: "Plausible blend of findOneAndUpdate + upsert:true; does not exist."
```

Probe types (cwd `evals/fixture`, `LC_ALL=C`): `node-member`, `dts-grep`, `source-grep`, `python-attr`, `cli-help`, `cli-exit` (temp git repo, pass if exit 0).

Ground truth: `verify-cases.ts` requires every `valid` probe to pass and every `trap` probe to fail. **A case that doesn't behave as labeled is fixed or replaced, never kept.** Schema: exactly 20 traps + 10 valid, unique ids, required fields, known probe type, package listed in fixture.

Target mix — Traps: 6 methods (mongoose, commander, yaml), 4 Python stdlib attrs, 5 CLI flags (git, node), 5 config/env keys (mongoose `set()`/schema options, dotenv). Valid: mongoose prototype/Query methods, commander hard-to-find methods, yaml re-exported API, a dotenv env key read only in `.js`, `pathlib.Path.walk`, a node flag, a git flag not listed in `git log -h`.

## 8. Implementation steps

1. **Scaffold + fixture.** *Done:* `npm ci && npm ci --prefix evals/fixture` succeed; mongoose loads from fixture; `npm run typecheck` passes.
2. **SKILL.md + lint + link check + CI.** *Done:* lint prints `ok`; `lint-skill.test.ts` fails each bad fixture (61 lines, 7 rules, 9 rules, gap in numbering, rule inside fence, no frontmatter).
3. **References.** Runnable examples in ```` ```sh example ```` blocks. *Done:* `recipes.test.ts` runs every block in `evals/fixture`, exit 0 + non-empty stdout; ≥ 2 per file.
4. **Cases + schema + ground truth.** *Done:* `npm run verify` 30/30 as labeled; `schema.test.ts` rejects duplicate id, unknown probe, 19/10 split, missing package.
5. **Scorer + metrics.** *Done:* ≥ 16 table-driven score tests covering every outcome (incl. trap with fake `file:line` → hallucinated; "throws if not found" → not flagged; `Unverified:` header; CLI evidence pattern; unmentioned → unclear); metrics tests for denominators and null token pairs.
6. **Runner.** *Done:* argv pinned for both agents × conditions; synthetic output parsing; `--dry-run` prints argv and spawns nothing; contamination guard exits 2 with fake `HOME`.
7. **README.** Pitch, install, illustrative mongoose before/after, comparison table (descriptions only), how to run evals, condensed §2, demo script, results block between `<!-- results:start -->`/`<!-- results:end -->`. *Done:* `readme.test.ts` (block is either the "No published results yet" sentence or a verbatim runner report) and `links` pass.

## 9. Test strategy

- **Unit (vitest, CI):** scorer, metrics, report, schema, argv/parse, lint-skill, links, README results rule.
- **Ground truth (CI):** `verify-cases.ts` against installed fixture packages, Python 3.12, git.
- **Recipes (CI):** every `sh example` block runs against the fixture.
- **Real agent runs:** optional/manual only, never in CI; results committed only when README cites them.
- **Number discipline:** no metric numbers anywhere except a verbatim runner `report.md`, enforced by `readme.test.ts`.
