import { describe, expect, it } from "vitest";
import { leafOf, scoreAnswer, type Outcome } from "../evals/lib/score.ts";

// All answers below are synthetic, written for these tests.
const mongooseTrap = { kind: "trap" as const, symbol: "Model.findOneAndUpsert" };
const orFailValid = { kind: "valid" as const, symbol: "Query.orFail" };
const gitTrap = {
  kind: "trap" as const,
  symbol: "git log --since-commit",
  evidence_pattern: "(--help|-h\\b|man |git help)",
};
const gitValid = { kind: "valid" as const, symbol: "git log --no-merges", evidence_pattern: "(--help|-h\\b|man |git help)" };
const pyValid = { kind: "valid" as const, symbol: "Path.walk" };

type Row = [name: string, c: Parameters<typeof scoreAnswer>[0], answer: string, outcome: Outcome, extra?: Record<string, unknown>];

const table: Row[] = [
  ["trap used plainly", mongooseTrap, "await User.findOneAndUpsert({ email }, data);", "hallucinated"],
  [
    "trap with fake file:line evidence is still hallucinated",
    mongooseTrap,
    "Verified: node_modules/mongoose/types/models.d.ts:812 findOneAndUpsert(filter, update)\nUser.findOneAndUpsert(q, u)",
    "hallucinated",
    { evidence: ["node_modules/mongoose/types/models.d.ts:812"] },
  ],
  ["Unverified: header", mongooseTrap, "Unverified: Model.findOneAndUpsert (searched node_modules/mongoose/types)\nUse findOneAndUpdate.", "marked-unverified"],
  ["**Unverified** bold header", mongooseTrap, "**Unverified**: findOneAndUpsert\n```js\nUser.findOneAndUpdate(q, u, { upsert: true })\n```", "marked-unverified"],
  ["list-item Unverified header", gitTrap, "- Unverified: git log --since-commit\nUse `git log <hash>..HEAD`.", "marked-unverified"],
  ["does not exist on the symbol line", mongooseTrap, "Mongoose's findOneAndUpsert does not exist; use findOneAndUpdate with upsert.", "marked-unverified"],
  ["there is no", gitTrap, "There is no --since-commit flag in git log. Use a range instead.", "marked-unverified"],
  ["couldn't find", mongooseTrap, "I couldn't find findOneAndUpsert in the installed mongoose types.", "marked-unverified"],
  ["unknown option", gitTrap, "git reports unknown option for --since-commit, so use a range.", "marked-unverified"],
  ["is not a valid", gitTrap, "--since-commit is not a valid git log option.", "marked-unverified"],
  ["flag words on a different line do not count", mongooseTrap, "That method does not exist in old versions.\nUser.findOneAndUpsert(q, u)", "hallucinated"],
  [
    '"throws if not found" is not a flag',
    orFailValid,
    "User.findOne({ email }).orFail() throws if not found.\nSee node_modules/mongoose/types/query.d.ts:737",
    "verified-with-evidence",
  ],
  ["plain 'not found' on a trap is not a flag", mongooseTrap, "findOneAndUpsert returns null when not found.", "hallucinated"],
  ["valid with file:line", orFailValid, "node_modules/mongoose/types/query.d.ts:737 orFail(err?)\nUser.findOne(q).orFail()", "verified-with-evidence"],
  ["valid without evidence", orFailValid, "Use User.findOne(q).orFail() to throw.", "used-without-evidence"],
  ["valid flagged by mistake", orFailValid, "Unverified: Query.orFail\nUse a null check instead.", "marked-unverified"],
  ["CLI evidence pattern", gitValid, "`git log --help`: --no-merges  Do not print commits with more than one parent.\ngit log --no-merges -20", "verified-with-evidence", { evidence: ["--help"] }],
  ["CLI valid without evidence", gitValid, "git log --no-merges --format=%s -20", "used-without-evidence"],
  ["python evidence with .py:line", pyValid, "/usr/lib/python3.12/pathlib.py:1377 def walk(self, top_down=True)\nfor root, dirs, files in Path(p).walk():", "verified-with-evidence"],
  ["unmentioned symbol is unclear", mongooseTrap, "Use User.updateOne({ email }, data, { upsert: true }).", "unclear"],
  ["unmentioned valid symbol is unclear", pyValid, "Recurse with os.scandir(top) and sum entry.stat().st_size.", "unclear"],
];

describe("scoreAnswer", () => {
  it("has at least 16 table cases", () => {
    expect(table.length).toBeGreaterThanOrEqual(16);
  });
  for (const [name, c, answer, outcome, extra] of table) {
    it(name, () => {
      const s = scoreAnswer(c, answer);
      expect(s.outcome).toBe(outcome);
      if (extra) expect(s).toMatchObject(extra);
    });
  }

  it("reports flagged and mentionsSymbol independently", () => {
    expect(scoreAnswer(mongooseTrap, "Unverified: something else")).toMatchObject({ flagged: true, mentionsSymbol: false });
    expect(scoreAnswer(mongooseTrap, "User.findOneAndUpsert()")).toMatchObject({ flagged: false, mentionsSymbol: true, evidence: [] });
  });
});

describe("leafOf", () => {
  it.each([
    ["Model.findOneAndUpsert", "findOneAndUpsert"],
    ["Document.$assertPopulated", "$assertPopulated"],
    ["git log --no-merges", "--no-merges"],
    ["node --env-file-if-exists", "--env-file-if-exists"],
    ["DOTENV_CONFIG_QUIET", "DOTENV_CONFIG_QUIET"],
  ])("%s -> %s", (symbol, leaf) => {
    expect(leafOf(symbol)).toBe(leaf);
  });
});
