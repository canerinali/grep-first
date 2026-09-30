# Installing grep-first

grep-first is one directory: [`skills/grep-first/`](skills/grep-first/) (`SKILL.md` plus `references/`). Installing means copying that directory to where your agent looks for skills. Nothing runs at install time and there are no dependencies.

## If you are a coding agent reading this

The user asked you to install grep-first. Do this, and nothing else:

1. Ask the user whether to install for all projects (user level) or only for the current repo (project level), unless they already said so.
2. Clone the repo to a temporary directory: `git clone --depth 1 https://github.com/canerinali/grep-first "$TMPDIR/grep-first"` (use `/tmp` if `$TMPDIR` is unset).
3. Copy `skills/grep-first` to the target from the table below for the agent you are. Create the parent directory if it is missing. If a `grep-first` directory already exists there, tell the user and ask before overwriting it.
4. Print the path of the installed `SKILL.md` and tell the user to start a new session so the skill is loaded.

| Agent | User level | Project level |
|---|---|---|
| Claude Code | `~/.claude/skills/grep-first/` | `<repo>/.claude/skills/grep-first/` |
| Codex | `~/.codex/skills/grep-first/` | append `SKILL.md` to `<repo>/AGENTS.md` |
| Any agent that reads `AGENTS.md` | not applicable | append `SKILL.md` to `<repo>/AGENTS.md` |

## Manual install

```sh
git clone --depth 1 https://github.com/canerinali/grep-first
cp -r grep-first/skills/grep-first ~/.claude/skills/        # Claude Code, all projects
cp -r grep-first/skills/grep-first .claude/skills/          # Claude Code, this repo only
cp -r grep-first/skills/grep-first ~/.codex/skills/         # Codex, all projects
cat grep-first/skills/grep-first/SKILL.md >> AGENTS.md      # any AGENTS.md agent, this repo only
```

When you append to `AGENTS.md`, the recipe links (`references/*.md`) point to files that are not in your repo. Either copy `skills/grep-first/references/` next to `AGENTS.md` as `references/`, or leave the links; the rules work without the recipes.

## Check that it loaded

Start a new session in a project that has `node_modules/mongoose` installed and ask:

> Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email.

With the skill loaded, the answer starts with `Unverified: Model.findOneAndUpsert` and uses `findOneAndUpdate(filter, update, { upsert: true })`.

## Update

```sh
cd grep-first && git pull
cp -r skills/grep-first ~/.claude/skills/    # or whichever target you used
```

## Uninstall

Remove the directory you copied (for example `~/.claude/skills/grep-first/`), or delete the appended section from `AGENTS.md`.
