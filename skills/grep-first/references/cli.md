# CLI flag recipes

Set `LC_ALL=C` so help text is in English and matches the flag you grep for.
Each block marked `sh example` is executed by the test suite.

## 1. `--help` output

```sh example
LC_ALL=C node --help | grep -n -- '--env-file-if-exists'
```

Quote the matching line as evidence: `node --help: --env-file-if-exists=...  set environment variables from supplied file`.

## 2. git subcommands

`git <sub> -h` prints only the common options and exits with status 129, so a flag missing there may still exist.
The full list is in the man page: `LC_ALL=C man -P cat git-log | grep -n -- '--no-merges'` or `git help log`.

```sh example
LC_ALL=C git log -h 2>&1 | grep -c -- '--no-merges' || true
LC_ALL=C git push -h 2>&1 | grep -n -- 'force-with-lease'
```

## 3. Try the flag where it is harmless

When help is incomplete, run the command in a throwaway repo. Unknown options fail fast (git exits 129, node exits 9).

```sh example
tmp=$(mktemp -d) && git -C "$tmp" init -q && git -C "$tmp" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
LC_ALL=C git -C "$tmp" log --no-merges --oneline -1 && echo "exit=$?"
LC_ALL=C git -C "$tmp" log --since-commit=HEAD 2>&1 | head -1
rm -rf "$tmp"
```

## 4. Is the subcommand itself real?

```sh example
git help -a | grep -nE '^\s+(worktree|sparse-checkout)\b'
```
