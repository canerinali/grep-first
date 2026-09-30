# grep-first：让你的编程智能体在使用某个方法、CLI 参数或配置键之前，先在本地已安装的源码中查找它；找不到就写 "Unverified"。
**安装：** 对 Claude Code 或 Codex 说 *"Install the grep-first skill from https://github.com/canerinali/grep-first by following its INSTALL.md"*，或者运行 `git clone https://github.com/canerinali/grep-first && cp -r grep-first/skills/grep-first ~/.claude/skills/`  
**使用：** 让智能体"用 mongoose 的 findOneAndUpsert 按 email upsert 一个 User"，它不会编造这个方法，而是回答 `Unverified: Model.findOneAndUpsert ... use findOneAndUpdate(filter, update, { upsert: true })`。

[English](../../README.md) | [Türkçe](README.tr.md) | **简体中文** | [Español](README.es.md) | [Português (Brasil)](README.pt-BR.md)

> 这是译文。以[英文 README](../../README.md) 为准；评测结果只在英文版中发布。

- **先查再写。** 每个新的外部符号都会在 `node_modules`、`site-packages` 或 `--help` 中查找，针对的是你实际安装的版本。
- **给出凭据。** 每一句"它存在"都附带 `file:line` 和函数签名，例如 `models.d.ts:1469 findOneAndUpdate(filter, update, options)`。
- **不猜，直接说 "Unverified"。** 说明它在哪里查过，并给出找到的最接近的真实 API。

## 对比：使用前 / 使用后

以下是为本 README 手写的示例（不是评测输出）。同一个提示：*"Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."*

不使用 grep-first：

```js
// Upserts a user by email.
export async function upsertUser(email, data) {
  return User.findOneAndUpsert({ email }, data, { new: true });
}
// findOneAndUpsert finds a matching document and updates it, or inserts it if none exists.
```

使用 grep-first：

```text
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts, Model at runtime: undefined)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(filter, update, options)
```

```js
export async function upsertUser(email, data) {
  return User.findOneAndUpdate({ email }, data, { upsert: true, new: true });
}
```

第一个版本在运行时会报错 `TypeError: User.findOneAndUpsert is not a function`。

## 功能

- 在写代码之前检查，依据的是已安装的内容（`node_modules`、`site-packages`、`--help`），而不是其他版本的文档。
- 每一句"它存在"都有一行证据：`file:line` 加上函数签名或 help 中的那一行。
- 什么都没找到时写 `Unverified: <symbol>`，说明查找过的位置，并建议最接近的真实 API。
- 覆盖类型检查器发现不了的地方：CLI 参数、配置与环境变量键、动态 JS/Python，以及 mongoose 原型方法。
- 从 lockfile 和已安装的 `package.json` 读取版本。
- 只针对新引入的外部符号，因此额外开销很小。
- 有 `tsc` 或 LSP 时优先使用它们。
- 提供 Node、Python、CLI 参数和 mongoose 的可复制查找配方，测试套件会逐一运行它们。
- 附带评测框架：20 个陷阱用例和 10 个有效但冷门的用例，每个都针对真实安装的包做过校验。

适用于 Claude Code、Codex 以及任何读取 SKILL.md 或 AGENTS.md 的智能体。它只是一个包含 8 条规则的 Markdown 文件，外加四个简短的配方文件。无需运行任何东西，也没有依赖。

## 示例输出

[`examples/verify-symbol.sh`](../../examples/verify-symbol.sh) 在评测 fixture（mongoose 9.10.3）上手动运行查找配方。以下是它的真实输出：

```text
$ ./examples/verify-symbol.sh
mongoose 9.10.3 (from node_modules/mongoose/package.json)
Verified: Model.findOneAndUpdate  node_modules/mongoose/types/models.d.ts:1469  findOneAndUpdate(...)
Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types/models.d.ts and Model at runtime: undefined)
Verified: git log --no-merges  (git log --no-merges exited 0 in a scratch repo)
Unverified: git log --since-commit=HEAD  (git said: fatal: unrecognized argument: --since-commit=HEAD)
```

更详细的讲解见 [`examples/before-after.md`](../../examples/before-after.md)。

## 安装

克隆一次，然后选择你的智能体：

```sh
git clone https://github.com/canerinali/grep-first
cp -r grep-first/skills/grep-first ~/.claude/skills/     # Claude Code
cp -r grep-first/skills/grep-first ~/.codex/skills/      # Codex
cat grep-first/skills/grep-first/SKILL.md >> AGENTS.md   # any AGENTS.md agent, per repo
```

按项目安装、更新和卸载见 [INSTALL.md](../../INSTALL.md)。技能文件是 [`skills/grep-first/SKILL.md`](../../skills/grep-first/SKILL.md)，配方在 [`skills/grep-first/references/`](../../skills/grep-first/references/)。

## 与同类工具对比

| | 做什么 | 何时检查 | 依据 |
|---|---|---|---|
| **grep-first** | 让智能体找到每个新的外部符号并给出 `file:line` + 签名，否则写 `Unverified` | 写代码之前 | 本地已安装的源码、`--help`、`man` |
| addyosmani source-driven-development | 让实现决策以官方文档为依据的技能 | 规划和实现过程中 | 框架文档 |
| Rune hallucination-guard | 检查代码中编造的 API | 代码写完之后 | 生成的代码 |
| Context7 | 把最新库文档放进智能体上下文的 MCP 服务器 | 拉取文档时 | 已发布的文档 |

它们可以互相配合。例如 Context7 提供文档，grep-first 再确认该符号在你安装的版本中确实存在。

## 评测

评测框架（仅用于开发，从不发布）在 [`evals/fixture`](../../evals/fixture/package.json) 的临时副本中，通过 `claude -p` 或 `codex exec` 分别在启用和不启用技能的情况下运行相同的用例。每个回答被评为 `hallucinated`、`verified-with-evidence`、`used-without-evidence`、`marked-unverified` 或 `unclear`。

```sh
npm ci && npm ci --prefix evals/fixture
npm run verify                                   # ground truth: every trap probe fails, every valid probe passes
npx tsx evals/run.ts --agent claude --limit 5 --dry-run   # print argv, spawn nothing
npx tsx evals/run.ts --agent claude --model sonnet --timeout 180
npx tsx evals/run.ts --agent codex --without-skill --only mongoose-
```

结果写入 `evals/results/<UTC-stamp>-<agent>/{raw.jsonl,report.md}`。报告包含以下指标：
- **hallucination rate**：被当作存在而使用的陷阱。
- **false-unverified rate**：被错误标记的有效符号。
- **evidence rate**：带 `file:line` 引用的有效符号。
- **token delta**：启用技能减去不启用技能，按用例配对。

用例在 [`evals/cases.yaml`](../../evals/cases.yaml) 中，每个陷阱都有注释说明它为什么看起来可信。

评测不衡量的内容（v0.1）：
- 评分器不会打开引用的 `file:line`。陷阱用例中编造的证据仍算作 `hallucinated`，但有效用例中编造的证据不会被发现。
- 运行器总是注入技能文本，因此衡量的是规则本身，而不是智能体能否自行发现该技能。
- 只支持 `claude -p` 和 `codex exec`，每个用例运行一次，只统计 token（不统计费用）。没有 hook、没有 MCP 服务器，也没有自动证据检查。
- 只覆盖 Node/TS、Python 标准库和 `git`/`node` 命令行。

### 结果

暂无已发布的结果。数字只会出现在[英文 README](../../README.md) 中，且是运行器 `report.md` 的逐字副本。

## 20 秒演示脚本

供以后录制 GIF：
1. （0-4 秒）在 `evals/fixture` 中打开终端，在 `claude` 中输入："Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."
2. （4-12 秒）智能体运行 `grep -n findOneAndUpsert node_modules/mongoose/types/models.d.ts` 和 `node -e "typeof require('mongoose').Model.findOneAndUpsert"`，两者都没有结果。
3. （12-20 秒）回答以 `Unverified: Model.findOneAndUpsert` 开头，引用 `models.d.ts:1469 findOneAndUpdate(...)`，并使用 `{ upsert: true }`。

## 参与贡献

欢迎提交 issue 和 PR。提交 PR 之前请运行：

```sh
npm ci && npm ci --prefix evals/fixture
npm run lint:skill && npm run links && npm run typecheck && npm run verify && npm test
```

- SKILL.md 不超过 60 行，且恰好包含 8 条编号规则，由 `npm run lint:skill` 强制检查。
- 新的评测用例必须通过 `npm run verify`：在固定版本的 fixture 上，陷阱的探测必须失败，有效用例的探测必须成功。与标签不符的用例需要修正或替换。
- `references/` 中每个 ` ```sh example ` 代码块都必须在 `evals/fixture` 中有输出并以 0 退出。
- 不要手动往 README 中添加基准数字，`test/readme.test.ts` 会拒绝它们。
- 译文位于 [`.github/readme/`](./)，以英文 README 为准。

## 许可证

[MIT](../../LICENSE) © 2026 canerinali
