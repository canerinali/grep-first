# mongoose recipes

mongoose adds many methods to prototypes (`Model`, `Document.prototype`, `Query.prototype`), so a
plain grep for `function name` often finds nothing. Check both the types and the runtime.
Each block marked `sh example` is executed by the test suite against `evals/fixture`.

## 1. Version

```sh example
node -p "require('mongoose/package.json').version"
```

## 2. Static model methods

```sh example
grep -n -E '^\s+findOneAndUpdate(<|\()' node_modules/mongoose/types/models.d.ts | head -3
node -e "const m = require('mongoose'); console.log('findOneAndUpdate', typeof m.Model.findOneAndUpdate, '| findOneAndUpsert', typeof m.Model.findOneAndUpsert)"
```

`findOneAndUpsert` is `undefined`: write `Unverified: Model.findOneAndUpsert` and use `findOneAndUpdate(filter, update, { upsert: true })`.

## 3. Query and Document prototype methods

```sh example
grep -n -E '^\s+orFail\(' node_modules/mongoose/types/query.d.ts
node -e "const m = require('mongoose'); console.log(typeof m.Query.prototype.orFail, typeof m.Document.prototype.\$assertPopulated)"
```

## 4. `mongoose.set()` keys and schema options

`mongoose.set()` only accepts keys from a fixed list, so grep that list, not the docs.

```sh example
grep -n "'strictQuery'" node_modules/mongoose/lib/validOptions.js
grep -n -E '^\s+timestamps\?:' node_modules/mongoose/types/schemaoptions.d.ts
```
