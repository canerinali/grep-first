# Before / after: one trap, one valid symbol

Illustrative walkthrough, written by hand. It is not an eval output. The commands and their output
are real and were run in [`evals/fixture`](../evals/fixture/package.json) (mongoose 9.10.3, commander 15.0.0).
To rerun the checks: [`verify-symbol.sh`](verify-symbol.sh).

## Trap: `Model.findOneAndUpsert`

Prompt: *"Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."*

**Before.** The agent trusts the prompt. The code type-checks only if `User` is `any`, and it fails at runtime with
`TypeError: User.findOneAndUpsert is not a function`.

```js
export const upsertUser = (email, data) => User.findOneAndUpsert({ email }, data, { new: true });
```

**After.** Rule 1 sends the agent to the installed source:

```sh
grep -n -E '^\s+findOneAndUpsert(<|\()' node_modules/mongoose/types/models.d.ts   # no output
node -e "console.log(typeof require('mongoose').Model.findOneAndUpsert)"          # undefined
grep -n -E '^\s+findOneAndUpdate(<|\()' node_modules/mongoose/types/models.d.ts | head -1
# 1469:    findOneAndUpdate<const Projection extends ProjectionType<TRawDocType>>(
```

```text
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts, Model at runtime: undefined)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(filter, update, options)
```

```js
export const upsertUser = (email, data) => User.findOneAndUpdate({ email }, data, { upsert: true, new: true });
```

## Valid but easy to doubt: `Command.showHelpAfterError`

Prompt: *"Using commander, make the CLI print help after an unknown-option error with program.showHelpAfterError()."*

The name sounds invented, but it is real. The agent should say so and show where it is declared, not flag it:

```sh
grep -rn --include='*.d.ts' -E '^\s+showHelpAfterError\(' node_modules/commander/
# node_modules/commander/typings/index.d.ts:604:  showHelpAfterError(displayHelp?: boolean | string): this;
```

```text
Verified: Command.showHelpAfterError  node_modules/commander/typings/index.d.ts:604  showHelpAfterError(displayHelp?: boolean | string): this
```

```js
import { Command } from "commander";
const program = new Command().showHelpAfterError("(run with --help for usage)");
```
