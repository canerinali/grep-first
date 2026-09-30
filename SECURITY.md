# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub private vulnerability reporting:
https://github.com/canerinali/grep-first/security/advisories/new

Do not open a public issue for a suspected vulnerability. There is no email contact for security reports.

Include what you found, how to reproduce it, and which version or commit you tested. You should get an acknowledgement within 7 days.

## Scope and known risk

- `skills/grep-first/SKILL.md` is plain Markdown instructions. It runs no code of its own.
- The eval harness (`evals/run.ts`) is a manual, opt-in developer tool. It spawns your own `claude` or `codex` CLI under your user account. Claude runs with `--allowedTools` that include `Bash(node:*)`, `Bash(python3:*)`, `Bash(git:*)` and `Bash(find:*)`, which amount to arbitrary code execution as your user. Codex runs with `--sandbox read-only`. Run the Claude evals only where you accept that, for example in a container or VM.
- `evals/cases.yaml` probes run the argv listed in the file. Only run `--cases` files you trust.
