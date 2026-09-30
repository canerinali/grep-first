# grep-first: your coding agent looks up a method, CLI flag or config key in the installed source before it uses it, or it writes "Unverified".
**Install:** tell Claude Code or Codex *"Install the grep-first skill from https://github.com/canerinali/grep-first by following its INSTALL.md"*, or run `git clone https://github.com/canerinali/grep-first && cp -r grep-first/skills/grep-first ~/.claude/skills/`  
**Use:** ask your agent "upsert a User by email with mongoose's findOneAndUpsert" and it answers `Unverified: Model.findOneAndUpsert ... use findOneAndUpdate(filter, update, { upsert: true })` instead of inventing the method.

**English** | [Türkçe](.github/readme/README.tr.md) | [简体中文](.github/readme/README.zh-CN.md) | [Español](.github/readme/README.es.md) | [Português (Brasil)](.github/readme/README.pt-BR.md)

<!-- badges -->
![License: MIT](https://img.shields.io/badge/license-MIT-blue) ![Claude Code skill](https://img.shields.io/badge/Claude_Code-skill-orange) ![Codex skill](https://img.shields.io/badge/Codex-skill-black)

- **Checks before it writes.** Each new external symbol is looked up in `node_modules`, `site-packages` or `--help`, for the version you have installed.
- **Shows the receipt.** Every "it exists" comes with `file:line` plus the signature, for example `models.d.ts:1469 findOneAndUpdate(filter, update, options)`.
- **Says "Unverified" instead of guessing.** It names where it searched and suggests the closest real API.

<!-- demo: record .github/readme/demo.gif with the vhs tape in LAUNCH.md, then embed it here -->

## Before / after

Illustrative example, written by hand for this README (not an eval output). Same prompt: *"Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."*

Without grep-first:

```js
// Upserts a user by email.
export async function upsertUser(email, data) {
  return User.findOneAndUpsert({ email }, data, { new: true });
}
// findOneAndUpsert finds a matching document and updates it, or inserts it if none exists.
```

With grep-first:

```text
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts, Model at runtime: undefined)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(filter, update, options)
```

```js
export async function upsertUser(email, data) {
  return User.findOneAndUpdate({ email }, data, { upsert: true, new: true });
}
```

The first version fails at runtime with `TypeError: User.findOneAndUpsert is not a function`.

## Features

- Checks before the code is written, against what is installed (`node_modules`, `site-packages`, `--help`), not against docs for some other version.
- Every "it exists" comes with an evidence line: `file:line` plus the signature or the help line.
- Says `Unverified: <symbol>` when it finds nothing, names where it searched and suggests the closest real API.
- Covers what type checkers miss: CLI flags, config and env keys, dynamic JS/Python and mongoose prototype methods.
- Reads the version from the lockfile and the installed `package.json`.
- Only for new, external symbols, so the extra cost stays small.
- Uses `tsc` or the LSP first when one is available.
- Copy-paste recipes for Node, Python, CLI flags and mongoose. The test suite runs every one of them.
- Comes with an eval harness: 20 trap cases and 10 valid-but-obscure cases, each checked against real installed packages.

## Example output

[`examples/verify-symbol.sh`](examples/verify-symbol.sh) runs the recipe by hand against the eval fixture (mongoose 9.10.3). This is its real output:

```text
$ ./examples/verify-symbol.sh
mongoose 9.10.3 (from node_modules/mongoose/package.json)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(...)
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts and Model at runtime: undefined)
Verified: git log --no-merges  (git log --no-merges exited 0 in a scratch repo)
Unverified: git log --since-commit=HEAD  (git said: fatal: unrecognized argument: --since-commit=HEAD)
```

A longer walkthrough is in [`examples/before-after.md`](examples/before-after.md).

## Install

Works with Claude Code, Codex and any agent that reads SKILL.md or AGENTS.md. It is one Markdown file with 8 rules plus four short recipe files. There is nothing to run and no dependencies.

Clone once, then pick your agent:

```sh
git clone https://github.com/canerinali/grep-first
cp -r grep-first/skills/grep-first ~/.claude/skills/     # Claude Code
cp -r grep-first/skills/grep-first ~/.codex/skills/      # Codex
cat grep-first/skills/grep-first/SKILL.md >> AGENTS.md   # any AGENTS.md agent, per repo
```

Per-project install, updating and uninstalling are in [INSTALL.md](INSTALL.md). The skill is [`skills/grep-first/SKILL.md`](skills/grep-first/SKILL.md). The recipes are in [`skills/grep-first/references/`](skills/grep-first/references/).

## How it compares

| | What it does | When it checks | Source of truth |
|---|---|---|---|
| **grep-first** | Makes the agent find each new external symbol and cite `file:line` + signature, or write `Unverified` | Before writing the code | Locally installed source, `--help`, `man` |
| addyosmani source-driven-development | Skill that grounds implementation decisions in official documentation | While planning and implementing | Framework docs |
| Rune hallucination-guard | Checks code for invented APIs | After the code is written | The generated code |
| Context7 | MCP server that puts current library docs into the agent's context | When docs are fetched | Published docs |

They fit together. For example, Context7 can supply docs and grep-first then checks that the symbol exists in the version you have installed.

## Evals

The harness (dev only, never published) runs the same cases with and without the skill through `claude -p` or `codex exec` in a temporary copy of [`evals/fixture`](evals/fixture/package.json). It scores each answer as `hallucinated`, `verified-with-evidence`, `used-without-evidence`, `marked-unverified` or `unclear`.

> **Security:** `--agent claude` runs Claude Code with `Bash(node:*)`, `Bash(python3:*)`, `Bash(git:*)` and `Bash(find:*)` allowed and no filesystem sandbox, so the agent can execute arbitrary code as your user. Run it only in a disposable environment (VM or container). Codex runs with `--sandbox read-only`. See [SECURITY.md](SECURITY.md).

```sh
npm ci && npm ci --prefix evals/fixture
npm run verify                                   # ground truth: every trap probe fails, every valid probe passes
npx tsx evals/run.ts --agent claude --limit 5 --dry-run   # print argv, spawn nothing
npx tsx evals/run.ts --agent claude --model sonnet --timeout 180
npx tsx evals/run.ts --agent codex --without-skill --only mongoose-
```

Results go to `evals/results/<UTC-stamp>-<agent>/{raw.jsonl,report.md}`. The report shows these metrics:
- **hallucination rate**: traps used as if they exist.
- **false-unverified rate**: valid symbols wrongly flagged.
- **evidence rate**: valid symbols cited with `file:line`.
- **token delta**: with-skill minus without-skill, paired by case.

Cases are in [`evals/cases.yaml`](evals/cases.yaml), with a comment on each trap explaining why it is plausible.

What the evals do not measure (v0.1):
- The scorer does not open the cited `file:line`. Invented evidence on a trap still counts as `hallucinated`, but invented evidence on a valid case is not caught.
- The runner always injects the skill text, so it measures the rules, not whether the agent discovers the skill on its own.
- Only `claude -p` and `codex exec`, one run per case, tokens only (no cost). There are no hooks, no MCP server and no automatic evidence checking.
- Only Node/TS, the Python stdlib and the `git`/`node` CLIs.

### Results

<!-- results:start -->
No published results yet. Numbers will appear here only as a verbatim copy of a runner `report.md`.
<!-- results:end -->

## 20-second demo script

For recording a GIF later:
1. (0-4s) Terminal in `evals/fixture`. Type into `claude`: "Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."
2. (4-12s) The agent runs `grep -n findOneAndUpsert node_modules/mongoose/types/models.d.ts` and `node -e "typeof require('mongoose').Model.findOneAndUpsert"`, and both come back empty.
3. (12-20s) The answer starts with `Unverified: Model.findOneAndUpsert`, cites `models.d.ts:1469 findOneAndUpdate(...)`, and uses `{ upsert: true }`.

## Contributing

Issues and PRs are welcome. Before opening a PR, run:

```sh
npm ci && npm ci --prefix evals/fixture
npm run lint:skill && npm run links && npm run typecheck && npm run verify && npm test
```

- SKILL.md stays at 60 lines or fewer, with exactly 8 numbered rules. `npm run lint:skill` enforces this.
- A new eval case must pass `npm run verify`: a trap's probe must fail and a valid case's probe must pass on the pinned fixture. A case that does not behave as labeled gets fixed or replaced.
- Every ` ```sh example ` block in `references/` must exit 0 with output inside `evals/fixture`.
- Do not add benchmark numbers to this README by hand. `test/readme.test.ts` rejects them.
- Translations are in [`.github/readme/`](.github/readme/). This English README is the source of truth, and eval results are published only here.

## License

[MIT](LICENSE) © 2026 canerinali
