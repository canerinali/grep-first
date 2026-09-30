# Node / TypeScript recipes

Run these from the project root (where `node_modules/` is). Replace the package and symbol.
Each block marked `sh example` is executed by the test suite against `evals/fixture`.

## 1. Which version is installed?

The lockfile says what was resolved; the installed `package.json` says what is on disk. Search that version.

```sh example
grep -n '"node_modules/commander"' -A 2 package-lock.json
grep -n -m 1 '"version"' node_modules/commander/package.json
```

`require('<pkg>/package.json')` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` when the package has an `exports` map without `./package.json` (commander does this), so read the file directly.

## 2. Find the declaration in `.d.ts` files

Declarations are the fastest place to get a `file:line` and a signature.

```sh example
grep -rn --include='*.d.ts' -E '^\s+showHelpAfterError\(' node_modules/commander/
```

No match in the types does not prove the symbol is missing. Check the runtime (recipe 4) and the source (recipe 5).

## 3. Follow the `exports` map and re-export chains

Find the entry file first, then follow `export ... from` lines until you reach the definition.

```sh example
node -p "JSON.stringify(require('yaml/package.json').exports['.'], null, 1)"
grep -n 'parseDocument' node_modules/yaml/dist/index.d.ts
grep -n 'export declare function parseDocument' node_modules/yaml/dist/public-api.d.ts
```

## 4. Runtime probe

Confirms the member exists at runtime, including prototype methods added dynamically.

```sh example
node -e "const { Command } = require('commander'); console.log(typeof Command.prototype.optsWithGlobals)"
node -e "const y = require('yaml'); console.log(Object.keys(y).filter(k => /^parse/.test(k)).join(' '))"
```

`undefined` means the member does not exist. Write `Unverified: <symbol>`.

## 5. Env keys and options read only in JavaScript

Some keys never appear in `.d.ts`. Search the shipped JS for the code that reads them.

```sh example
grep -rn --include='*.cjs' --include='*.js' 'process.env.DOTENV_CONFIG_QUIET' node_modules/dotenv/
```

Evidence line format: `node_modules/dotenv/dist/config.cjs:6  : process.env.DOTENV_CONFIG_QUIET`.
