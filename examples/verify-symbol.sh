#!/usr/bin/env bash
# Runs the grep-first recipe by hand against evals/fixture: one real mongoose method,
# one invented one, one real git flag and one invented flag. Prints the evidence line
# an agent following SKILL.md should write. Needs: npm ci --prefix evals/fixture
set -euo pipefail
export LC_ALL=C

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fixture="$here/../evals/fixture"
cd "$fixture"
if [ ! -d node_modules/mongoose ]; then
  echo "run: npm ci --prefix evals/fixture" >&2
  exit 2
fi

version="$(node -p "require('mongoose/package.json').version")"
echo "mongoose $version (from node_modules/mongoose/package.json)"

# Method: runtime check first, then the declaration for file:line + signature.
check_model_method() {
  local name="$1" kind hit
  kind="$(node -e "process.stdout.write(typeof require('mongoose').Model[process.argv[1]])" "$name")"
  hit="$(grep -n -E "^\s+${name}(<|\()" node_modules/mongoose/types/models.d.ts | head -1 || true)"
  if [ "$kind" = "function" ] && [ -n "$hit" ]; then
    local line="${hit%%:*}" sig
    sig="$(echo "${hit#*:}" | sed -E 's/^\s+//; s/<.*//')"
    echo "Verified: Model.$name  node_modules/mongoose/types/models.d.ts:$line  $sig(...)"
  else
    echo "Unverified: Model.$name (searched node_modules/mongoose/types/models.d.ts and Model at runtime: $kind)"
  fi
}

# Flag: try it in a throwaway repo, quote the error when git rejects it.
check_git_log_flag() {
  local flag="$1" tmp out
  tmp="$(mktemp -d)"
  git -C "$tmp" init -q
  git -C "$tmp" -c user.name=demo -c user.email=demo@example.invalid commit -q --allow-empty -m init
  if out="$(git -C "$tmp" log "$flag" --oneline -1 2>&1)"; then
    echo "Verified: git log $flag  (git log $flag exited 0 in a scratch repo)"
  else
    echo "Unverified: git log $flag  (git said: $(echo "$out" | head -1))"
  fi
  rm -rf "$tmp"
}

check_model_method findOneAndUpdate
check_model_method findOneAndUpsert
check_git_log_flag --no-merges
check_git_log_flag --since-commit=HEAD
