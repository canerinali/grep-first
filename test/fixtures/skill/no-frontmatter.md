
# grep-first

Prove an external symbol exists in the installed code before you write it.
Installed source beats memory and beats docs for a different version.

## Rules

1. Before using a new external symbol (method, function, class, option), find its definition in the installed source: `node_modules/<pkg>`, the Python `site-packages`/stdlib, or the binary's own help.
2. Read the version from the lockfile and from the installed `package.json` (or `importlib.metadata.version`). Search that version, not the one you remember.
3. For a CLI flag, check `LC_ALL=C <cmd> --help`, `man -P cat <cmd>` or `git help <sub>` first, and quote the matching help line.
4. For a config or env key, find the schema, the type, or the code that reads the key (`process.env.X`, `options.x`, `os.environ`).
5. Show evidence as `file:line` plus the signature or help line, for example `node_modules/mongoose/types/models.d.ts:1469 findOneAndUpdate(filter, update, options)`.
6. If nothing is found, write `Unverified: <symbol>` with where you searched, do not use it as if it exists, and suggest the closest real alternative you did find.
7. Apply this only to symbols that are new to the code you are writing and that come from outside the repo. Do not re-verify symbols already used in the repo or defined in it.
8. When a type checker or LSP is available (`tsc --noEmit`, pyright, go-to-definition), use it first; fall back to grep for what it cannot see (flags, env keys, dynamic members).

## Output example

```
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(filter, update, options)
Verified: --no-merges  git log --help: "--no-merges  Do not print commits with more than one parent."
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types, Model at runtime); use findOneAndUpdate(filter, update, { upsert: true })
```

## Search recipes

- Node / TypeScript packages: [references/node.md](references/node.md)
- Python stdlib and site-packages: [references/python.md](references/python.md)
- CLI flags (`git`, `node`, anything with `--help`): [references/cli.md](references/cli.md)
- mongoose prototype, static and Query methods: [references/mongoose.md](references/mongoose.md)
