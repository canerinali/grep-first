# Security review: grep-first 0.1.0

Date: 2026-09-30. Scope: every tracked file at commit `49a5d09`, plus the full git history. Line numbers refer to the working tree after the fixes below.

## Summary

| ID | Severity | Title | Status |
| -- | -------- | ----- | ------ |
| M1 | Medium | Claude eval run allows arbitrary code execution, with no warning | Fixed (warning added); residual risk accepted by design |
| M2 | Medium | Predictable eval workdir in shared tmp | Fixed |
| L1 | Low | Quadratic regex in scorer on agent output | Open (accepted) |
| L2 | Low | `--cases` file controls executed argv and regexes | Open (documented) |
| L3 | Low | `examples/verify-symbol.sh` temp repo cleanup and git config | Open (accepted) |
| I1–I9 | Info | Audit, secrets, identity, network, CI, licenses, misc | No action |

No High findings. No Medium findings remain open. One follow-up is recommended outside this review's scope: put the M1 warning in README.md (§Evals).

## Medium

### M1: Claude eval run allows arbitrary code execution, with no warning

- **Where:** `evals/lib/agents.ts:7-20` (`CLAUDE_ALLOWED_TOOLS`) and `evals/lib/agents.ts:56`.
- **Evidence:** `Bash(node:*)` allows `node -e '<anything>'`. `Bash(python3:*)` allows `python3 -c`. `Bash(git:*)` allows `git -c core.pager=… log`, `git -c alias.x='!sh …'` and similar. `Bash(find:*)` allows `find -exec`/`-delete`. Each one is arbitrary code execution as the user, and Claude has no filesystem sandbox, so `cwd` being a temp dir does not contain it. Content the agent reads could steer it: the fixture's third-party `node_modules` source, and the case prompts. Codex, by contrast, runs with `--sandbox read-only` (`evals/lib/agents.ts:60`). The runner is manual and opt-in (`npm run eval`, never run in CI), but neither README.md nor `--help` warned about this.
- **Fix:** `evals/run.ts:31-40`. `--help` now has a "Security:" paragraph, and every `--agent claude` invocation (including `--dry-run`) prints `CLAUDE_EXEC_WARNING` to stderr. SECURITY.md documents the risk. The allowlist is unchanged on purpose: PLAN.md §5 pins the argv, and the agent needs `node`/`python3`/`git` to verify symbols, which is exactly what the eval measures.
- **Status:** Fixed (warning). The residual risk is accepted by design. README.md was out of scope for this review, so the same warning still needs adding to README §Evals.

### M2: Predictable eval workdir in shared tmp

- **Where:** `evals/run.ts` (before the fix: `const workdir = join(tmpdir(), \`grep-first-${stamp}\`)`, where the stamp has one-second resolution).
- **Evidence:** On a multi-user host with a shared `/tmp`, another user could create that path in advance, as a directory or a symlink. `cpSync` would then copy into it, and the agent (which can execute code, see M1) would run inside a tree an attacker controls, for example with planted `node_modules`. The final `rmSync(workdir, {recursive})` would also act on the pre-created path. Separately, `prepareWorkdir` ran outside the `try`, so a failed `git init/commit` leaked the copy.
- **Fix:** `evals/run.ts:246` now uses `mkdtempSync(join(tmpdir(), \`grep-first-${stamp}-\`))`, which gives a random suffix and mode 0700 and fails rather than reuse an existing path. `prepareWorkdir` moved inside the `try`/`finally` (`evals/run.ts:251`) so cleanup always runs. Dry-run prints a `…-XXXXXX` placeholder (`evals/run.ts:231`).
- **Verification:** A smoke run with a fake `claude` on `PATH` produced workdir `/tmp/grep-first-2026-09-30T19-51-59Z-Z4yXYP`, which was gone after the run, and exited 0. The existing dry-run tests pass.
- **Status:** Fixed.

## Low

### L1: Quadratic regex in scorer on agent output

- **Where:** `evals/lib/score.ts:20` (`FILE_LINE`).
- **Evidence:** `[\w@$./-]*[\w$-]\.(?:…):\d+` is retried from every start position inside a long token. Measured: 50k × `a` took 1.9 s, 100k × `a` took 7.6 s, and 50k × `a.` took 11.5 s. The input is the user's own agent answer, and `maxBuffer` caps it at 64 MB. A pathological answer could hang the local scorer, but it cannot affect anything else.
- **Suggested fix:** Anchor the start with `(?<![\w@$./-])`. Match semantics stay the same (the leftmost match always starts at a token boundary), and the cost becomes linear.
- **Status:** Open (accepted, Low).

### L2: `--cases` file controls executed argv and regexes

- **Where:** `evals/run.ts:64` (`--cases`), `evals/verify-cases.ts` (argv[2]), `evals/lib/probe.ts:108-126` (`cli-help` / `cli-exit` spawn `probe.cmd` as given), `evals/lib/probe.ts:38` and `evals/lib/schema.ts:95` / `evals/lib/score.ts:36` (`pattern` / `evidence_pattern` compiled with `new RegExp`).
- **Evidence:** A cases file can run any program with any arguments, and supply any regex, including a catastrophic one. `spawnSync` is always called with an argv array and never with `shell: true`, so no shell-injection path exists. Case ids are never used in file paths. The default `evals/cases.yaml` is repo-controlled and reviewed (only `git` and `node` appear in `cmd`), which is acceptable.
- **Status:** Open (documented in SECURITY.md: only run cases files you trust).

### L3: `examples/verify-symbol.sh` temp repo cleanup and git config

- **Where:** `examples/verify-symbol.sh:36-44`.
- **Evidence:** Quoting is correct (`"$tmp"`, `"$flag"`, and `$name` passed to node via argv). However, with `set -e` a failing `git init`/`commit` exits before `rm -rf "$tmp"`, because no `trap` is set, so the temp dir leaks. The `git commit` also inherits the user's global git config, so `core.hooksPath` hooks or `commit.gpgsign` would take effect. The eval probes avoid this with `GIT_CONFIG_GLOBAL=/dev/null` (`evals/lib/probe.ts`), but the script does not. `mktemp -d` is used, so the name is not predictable.
- **Suggested fix:** Add `trap 'rm -rf "$tmp"' RETURN`, and set `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1` for the two git calls.
- **Status:** Open (accepted, Low).

## Info

- **I1: npm audit.** Root: `found 0 vulnerabilities`. `npm audit --prefix evals/fixture`: `found 0 vulnerabilities`. Every `resolved` URL in both lockfiles points at `https://registry.npmjs.org` (114 entries), with integrity hashes. Packages with install scripts: `esbuild`, and `fsevents` (macOS only), both transitive dev dependencies.
- **I2: Secrets.** `git grep` over tracked files and `git log -p --all` over the full history found no match for `AKIA…`, `sk-…`, `sk-ant-`, `ghp_`, `github_pat_`, `xox?-`, `BEGIN … PRIVATE KEY`, `password=`/`:`, `secret=`, `api_key=`, `Bearer`, or `mongodb(+srv)://user:pass@`. No `.env`, `.pem`, `.key` or `.npmrc` file was ever committed.
- **I3: Identity.** `insurup` appears in no tracked file, in no working-tree file outside `node_modules`/`.git`, and in no commit of `git log -p --all` (0 hits). `git log --all --format='%an %ae %cn %ce'` shows all 8 commits as `canerinali 32527189+canerinali@users.noreply.github.com`.
- **I4: Network/telemetry.** No `fetch`, `http(s)`, `net`, `dns`, `WebSocket` or HTTP client exists anywhere in `evals/`, `scripts/`, `test/` or `examples/`. The only processes spawned are `claude`/`codex` (the user's own CLIs), `git`, `node`, `python3`, `bash`/`sh` (tests), and `npx tsx` (tests). Codex gets `stdin: ignore` (`evals/run.ts:176`), which avoids the known `codex exec` stdin hang.
- **I5: CI.** `.github/workflows/ci.yml:8-9` sets `permissions: contents: read`. The workflow uses no secrets and triggers only on `push` to main and `pull_request` (not `pull_request_target`). Actions are pinned by major tag (`@v4`, `@v5`), not by SHA, which is acceptable for a repo with a read-only token.
- **I6: Licenses (project is MIT).** Direct root devDependencies: `@types/node` MIT, `tsx` MIT, `typescript` Apache-2.0, `vitest` MIT, `yaml` ISC. Transitive root dependencies: 74 MIT, 3 Apache-2.0, 2 ISC, 1 BSD-3-Clause, 12 MPL-2.0 (`lightningcss` and its platform binaries, pulled in by vite through vitest). Fixture: `commander` MIT, `dotenv` BSD-2-Clause, `mongoose` MIT, `yaml` ISC; its transitive dependencies are 15 MIT, 4 Apache-2.0, 2 BSD-2-Clause, 1 ISC. All of these are dev/eval-only and never redistributed (`"private": true`, nothing published), so MIT is compatible with all of them. MPL-2.0 would only impose obligations if lightningcss files were redistributed in modified form.
- **I7: Path handling.** `--out` is resolved relative to cwd, and output goes only to `<out>/<stamp>-<agent>/{raw.jsonl,report.md}`. This is a user-chosen path by design. `writeFiles` keys are constants (`AGENTS.md`), and the skill copy target is the constant `.grep-first`. Probe temp repos use `mkdtempSync` and are removed in a `finally` (`evals/lib/probe.ts`).
- **I8: Case isolation.** `resetWorkdir` (`evals/run.ts:155-157`) runs `git checkout` + `git clean -fd`, which does not remove ignored files. If an agent modifies `node_modules/`, the change persists into later cases within the same run. This is an eval-integrity issue, not a security one. `git clean -fdx` plus re-copying `node_modules` would fix it.
- **I9: Misc.** `scripts/check-links.ts:49` calls `decodeURIComponent`, which throws on a malformed `%` in a Markdown link and crashes the checker; it only reads repo Markdown. `test/recipes.test.ts:28` runs the ` ```sh example ` blocks from `skills/grep-first/references/*.md` through `sh -c`, and that content is repo-controlled.

## Verification after fixes

```
===== npm run test
 Test Files  9 passed (9)
      Tests  122 passed (122)
exit 0
===== npm run typecheck
> tsc --noEmit -p tsconfig.json
exit 0
===== npm run lint:skill
ok: 35 lines, 8 rules
exit 0
===== npm run links
ok: 10 markdown files, all relative links resolve
exit 0
===== npm run verify
ok   valid node-env-file-if-exists                    probe pass  node --env-file-if-exists=.env -e 0 exited 0: .env not found. Continuing without it.
ok   valid git-log-no-merges                          probe pass  git log --no-merges --oneline -1 exited 0

30/30 cases behave as labeled
exit 0
```
