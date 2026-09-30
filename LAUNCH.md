# grep-first launch plan

Goal: the first 100 GitHub stars for `canerinali/grep-first`.
Written 2026-09-30. Nothing here has been posted, pushed or submitted; every step below is for the maintainer to do by hand.

Ground rules for every channel:
- No benchmark numbers until a real `evals/run.ts` report exists. Then quote it verbatim and link the committed `report.md`.
- No star counts for this project, no "trending", no invented user quotes.
- The before/after in the README is labeled illustrative. Say so wherever it is reused.
- Never ask anyone (HN, Reddit, X) to upvote. HN treats vote requests as manipulation.

---

## 1. README first screen (applied to README.md)

`test/readme.test.ts` pins lines 1-3 (title, install, usage), so the first screen is those three lines, the language bar, the badges and three bullets, followed directly by the before/after.

**Title (line 1):**
> grep-first: your coding agent looks up a method, CLI flag or config key in the installed source before it uses it, or it writes "Unverified".

**One sentence (install, line 2):**
> Tell Claude Code or Codex "Install the grep-first skill from https://github.com/canerinali/grep-first by following its INSTALL.md", or run `git clone https://github.com/canerinali/grep-first && cp -r grep-first/skills/grep-first ~/.claude/skills/`

**Three bullets:**
- **Checks before it writes.** Each new external symbol is looked up in `node_modules`, `site-packages` or `--help`, for the version you have installed.
- **Shows the receipt.** Every "it exists" comes with `file:line` plus the signature, for example `models.d.ts:1469 findOneAndUpdate(filter, update, options)`.
- **Says "Unverified" instead of guessing.** It names where it searched and suggests the closest real API.

**Repo description (GitHub "About", 110 chars):**
> Makes Claude Code and Codex cite file:line from the installed source before using an API, or say "Unverified".

---

## 2. Demo plan

### What to record

**Hero GIF (README, X, LinkedIn, dev.to): `./examples/verify-symbol.sh`.**
Deterministic, about 10 seconds, needs no API key, and every line is real output that `test/readme.test.ts` checks against the README. It shows all four outcomes in one screen: a real mongoose method with `file:line`, an invented mongoose method marked `Unverified`, a real git flag and an invented git flag with git's own error.

**Second clip (HN first comment, Reddit, dev.to): a real Claude Code session on the mongoose trap.**
Agent output varies between runs, so record it and use it only as captured. If the run without the skill does not hallucinate, do not re-roll until it does; show the with-skill run alone and say what it looked like. Never edit agent output.

### vhs tape (hero GIF)

Saved as [`.github/readme/demo.tape`](.github/readme/demo.tape). Content:

```tape
# Hero GIF for the README. Deterministic: it only runs examples/verify-symbol.sh.
# Prereq: npm ci --prefix evals/fixture
# Run from the repo root:  vhs .github/readme/demo.tape
Output .github/readme/demo.gif

Require bash
Require node
Require git

Set Shell "bash"
Set FontSize 18
Set Width 1500
Set Height 460
Set Padding 24
Set TypingSpeed 40ms
Set Theme "Catppuccin Mocha"

Hide
Type "export PS1='$ ' LC_ALL=C && clear"
Enter
Show

Type "# Does mongoose 9 have Model.findOneAndUpsert? Does git log take --since-commit?"
Sleep 1.2s
Enter
Type "# Ask the installed source, not the model's memory:"
Sleep 1s
Enter
Type "./examples/verify-symbol.sh"
Sleep 600ms
Enter
Sleep 6s
```

`vhs` is not installed on this machine (checked 2026-09-30). Install it with `go install github.com/charmbracelet/vhs@latest` (it also needs `ttyd` and `ffmpeg`; `ffmpeg` is already present), or from your distro's package manager.

After recording, embed it where README.md has the `<!-- demo: ... -->` comment:

```md
![grep-first checking a real and an invented mongoose method and git flag](.github/readme/demo.gif)
```

Keep the GIF under about 2 MB (GitHub renders larger ones but they load slowly on mobile); lower `Width` or `FontSize` if needed.

### asciinema alternative

```sh
npm ci --prefix evals/fixture
asciinema rec --cols 110 --rows 14 --overwrite -c "bash -c 'LC_ALL=C ./examples/verify-symbol.sh; sleep 4'" /tmp/grep-first.cast
agg --font-size 18 /tmp/grep-first.cast .github/readme/demo.gif   # cast -> GIF, https://github.com/asciinema/agg
```

### Live agent clip (second clip)

Use a throwaway copy of the fixture with a project-level install, so nothing lands in `~/.claude/skills/` (the eval runner refuses to run when a user-level grep-first install exists):

```sh
npm ci --prefix evals/fixture
tmp="$(mktemp -d)" && cp -r evals/fixture/. "$tmp"
mkdir -p "$tmp/.claude/skills" && cp -r skills/grep-first "$tmp/.claude/skills/"
cd "$tmp" && asciinema rec --cols 110 --rows 32 -c claude /tmp/grep-first-live.cast
# In Claude Code, type:
#   Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email.
```

For the "before" half, repeat in a second copy without the `.claude/skills` step. Put the two clips next to each other only if both are real, unedited runs.

---

## 3. Share texts

### Show HN

**Title (75 chars):**
> Show HN: grep-first – make coding agents cite file:line before using an API

**URL:** `https://github.com/canerinali/grep-first`

**First comment (post right after submitting):**

> Hi HN. I kept getting code from agents that called methods that don't exist in the version I have installed: `Model.findOneAndUpsert` in mongoose, `git log --since-commit`, config keys that no library reads. Type checkers catch some of this, but not CLI flags, env/config keys, dynamic JS/Python, or mongoose's prototype methods when a model is typed loosely.
>
> grep-first is a single SKILL.md (8 rules, under 60 lines) for Claude Code, Codex, or anything that reads AGENTS.md. Before the agent uses a new external symbol, it has to find it in the installed source (`node_modules/*.d.ts`, `site-packages`, `--help`, `man`) for the version in your lockfile, and show `file:line` plus the signature. If it can't find it, it writes `Unverified: <symbol>`, says where it looked, and suggests the closest real API. It only applies to new, external symbols, so it doesn't re-check everything.
>
> There's also a small eval harness: 20 trap cases (plausible but invented methods, flags and keys) and 10 real-but-obscure ones, each ground-truth checked against pinned packages (a trap's probe must fail and a valid one's must pass). It runs the same prompts with and without the skill through `claude -p` or `codex exec`. I haven't published numbers yet, and the README won't show any that aren't a verbatim runner report. Known gaps: the scorer doesn't open the cited file:line, and the runner injects the skill text rather than testing whether the agent picks it up on its own.
>
> It's complementary to doc-fetching tools like Context7: they give the agent docs, and this makes it check that the symbol exists in what's actually installed. I'd love trap cases from your own stack where an agent confidently used something that doesn't exist.

(If a real eval report exists by launch day, add one sentence with the headline number and a link to the committed `report.md`. Otherwise keep the text above as it is.)

### Reddit

Read each sidebar the same day you post; rules change. Disclose that you are the author. Space posts at least a day apart and write each one fresh instead of cross-posting.

| Subreddit | Why | Rules found (2026-09-30) | Post? |
|---|---|---|---|
| r/ClaudeAI | Largest Claude Code audience; skills are on-topic | Project posts go under the "Built with Claude" flair and must say what you built, how, show screenshots/demo and include at least one prompt you used | Yes, 2026-10-07 |
| r/ClaudeCode | Narrower, more technical Claude Code users | Has a weekly showcase for demos | Yes, in that week's showcase |
| r/ChatGPTCoding | Codex and multi-agent users | Self-promotion goes in the weekly self-promotion thread | Yes, in the weekly thread only |
| r/programming | Big, but low tolerance for self-promotion; "I built" posts are usually removed | 90/10 participation norm, promotional posts removed | No launch post. At most, link the dev.to write-up later if it is technical enough on its own |
| r/node | The mongoose example is squarely Node | Not checked | Optional, only after checking the sidebar |

**r/ClaudeAI post (flair: Built with Claude)**

Title:
> I made a skill that makes Claude Code show file:line before it uses a library method, or say "Unverified"

Body:
> **What:** grep-first, a single SKILL.md (8 rules) for Claude Code and Codex. Before Claude uses a new external method, CLI flag or config key, it has to find it in what you have installed (`node_modules/*.d.ts`, `site-packages`, `--help`) and cite `file:line` + signature. If it can't, it writes `Unverified: <symbol>` and suggests the closest real API.
>
> **Why:** I kept getting confident code like `User.findOneAndUpsert(...)` (not a mongoose method) or `git log --since-commit` (not a git flag). Type checkers miss flags, env keys and dynamic JS/Python.
>
> **How I built it:** with Claude Code. The rules were short enough to lint (60 lines max, exactly 8 rules). The work went into 30 eval cases, each checked against real pinned packages, and a runner that compares `claude -p` with and without the skill. No results are published yet.
>
> **Prompt to try:** in a project with mongoose installed: *"Using mongoose's Model.findOneAndUpsert, write a function that upserts a User by email."*
>
> [demo GIF]
>
> Install: `git clone https://github.com/canerinali/grep-first && cp -r grep-first/skills/grep-first ~/.claude/skills/`
>
> Repo (MIT): https://github.com/canerinali/grep-first. I'm the author and would like trap cases from your stack.

**r/ChatGPTCoding weekly thread (short):**
> grep-first: one SKILL.md for Codex / Claude Code. Before the agent uses a new external method, CLI flag or config key, it has to find it in the installed source and cite `file:line` + signature, or write "Unverified". MIT, no dependencies. Codex install: `cp -r grep-first/skills/grep-first ~/.codex/skills/`. https://github.com/canerinali/grep-first

### X / Twitter thread (5 posts)

1. > Your coding agent just wrote `User.findOneAndUpsert(...)`. mongoose has no such method.
   >
   > I made grep-first: one SKILL.md that makes Claude Code and Codex find a symbol in the installed source before using it, or say "Unverified". [GIF]
   > https://github.com/canerinali/grep-first
2. > The rule: before using a new external method, CLI flag or config key, find it in node_modules/*.d.ts, site-packages or --help, for the version in your lockfile, and cite file:line + signature.
   >
   > No match means `Unverified: <symbol>` plus where it looked and the closest real API.
3. > Why not just rely on tsc? Type checkers don't see CLI flags (`git log --since-commit`), env and config keys, dynamic JS/Python, or loosely typed mongoose models. That's where agents make things up most confidently.
4. > It ships with 30 eval cases: 20 plausible fakes and 10 real-but-obscure APIs, each checked against pinned packages. The runner compares `claude -p` / `codex exec` with and without the skill. No numbers published yet; they'll only appear as a verbatim report.
5. > MIT, no dependencies, 8 rules in under 60 lines. Works with anything that reads SKILL.md or AGENTS.md.
   >
   > Install: `cp -r grep-first/skills/grep-first ~/.claude/skills/`
   >
   > Send me trap cases where your agent invented an API. They become eval cases.

### LinkedIn (Türkçe, sigorta ve teknoloji okuru için)

> Yapay zekâ kodlama ajanlarının en tehlikeli hatası yanlış kod değil, kendinden emin bir şekilde yazılmış *var olmayan* kod.
>
> Ajan `findOneAndUpsert` diye bir metot çağırıyor. Kulağa doğru geliyor ama mongoose'da böyle bir metot yok. Bir CLI komutuna var olmayan bir parametre ekliyor ya da hiçbir kütüphanenin okumadığı bir config anahtarı yazıyor. Tip denetleyicisi bunların çoğunu yakalamıyor. Hata ancak çalışma anında, bazen de canlı ortamda ortaya çıkıyor.
>
> Sigorta gibi denetimin ve izlenebilirliğin önemli olduğu sektörlerde "bu parametre gerçekten var mı?" sorusunun cevabı tahmin olmamalı, kanıt olmalı.
>
> Bu yüzden grep-first'ü yazdım ve açık kaynak (MIT) olarak paylaştım. Claude Code ve Codex için 8 kurallık tek bir SKILL.md dosyası:
> • Ajan yeni bir dış metodu, CLI parametresini ya da config anahtarını kullanmadan önce onu projede kurulu olan kaynak kodda arıyor.
> • Bulduğunda kanıtını gösteriyor: dosya:satır ve metodun imzası.
> • Bulamadığında uydurmuyor, açıkça "Unverified" diyor ve en yakın gerçek alternatifi öneriyor.
>
> Yanında 30 vakalık bir değerlendirme seti de var: 20 inandırıcı sahte API ve 10 gerçek ama az bilinen API. Her biri gerçek paketlere karşı doğrulandı. Sonuçları, ölçümü yaptıktan sonra olduğu gibi paylaşacağım.
>
> Ekiplerinizde kodlama ajanı kullanıyorsanız deneyip geri bildirim verirseniz çok sevinirim: https://github.com/canerinali/grep-first
>
> #YapayZeka #YazılımGeliştirme #AçıkKaynak #Sigortacılık #ClaudeCode

(Kişisel hesaptan paylaşın. İşverenin adını ya da logosunu kullanmayın. Gönderinin ilk görseli demo GIF'i olsun.)

### dev.to

**Title:**
> Make your coding agent show a receipt: file:line, or "Unverified"

**Tags:** `ai`, `claude`, `productivity`, `opensource`

**Summary (the post's first paragraph):**
> Coding agents invent APIs with confidence: `Model.findOneAndUpsert`, `git log --since-commit`, config keys no library reads. Type checkers catch some of these but miss CLI flags, env keys and dynamic code. This post walks through grep-first, an 8-rule SKILL.md for Claude Code and Codex that makes the agent find each new external symbol in the installed source and cite `file:line` + signature before it uses it, or write "Unverified". It also covers how the 30 ground-truth-verified eval cases were built, and what the harness does not measure yet.

**Outline:** the mongoose trap (real `grep`/`node -e` output from `examples/before-after.md`) → why type checkers are not enough → the 8 rules → recipes (Node `.d.ts`, Python `inspect`, `--help`) → how a trap case is verified (probe must fail) → limits → install. Set the canonical URL to the GitHub README only if the post is mostly a copy of it.

---

## 4. Distribution list

### Awesome lists (all found via web search on 2026-09-30)

| List | URL | How to submit | Requirements | Earliest date |
|---|---|---|---|---|
| hesreallyhim/awesome-claude-code | https://github.com/hesreallyhim/awesome-claude-code | Web UI issue form only: https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml (no PRs, no `gh` CLI; bypassing the form can get you restricted) | At least 14 days old with active development after the first day, **or** 100 stars. Submitted by a human. One resource at a time. Description: one factual line, no emojis, not addressed to the reader | **2026-10-14** (first commit 2026-09-30; keep committing real fixes in between) |
| travisvn/awesome-claude-skills | https://github.com/travisvn/awesome-claude-skills ([CONTRIBUTING](https://github.com/travisvn/awesome-claude-skills/blob/main/CONTRIBUTING.md)) | Fork, add a row in the right section, open a PR | PRs from repos with fewer than 10 stars are closed automatically. The PR must not be written or submitted with AI assistance, so write it yourself. They want more than a bare SKILL.md; point to the recipes and the eval harness | Once the repo has at least 10 stars |
| RoggeOhta/awesome-codex-cli | https://github.com/RoggeOhta/awesome-codex-cli ([CONTRIBUTING](https://github.com/RoggeOhta/awesome-codex-cli/blob/main/CONTRIBUTING.md)) | Open an issue with the link and a description, or send a PR editing README.md | Must be directly related to Codex CLI, so lead with the `~/.codex/skills/` install. One sentence. Include a shields.io stars badge. Format: `- [owner/repo](url) - Description. ![stars badge]`. Likely section: Specialized Skills | 2026-10-13 |
| VoltAgent/awesome-agent-skills | https://github.com/VoltAgent/awesome-agent-skills ([CONTRIBUTING](https://github.com/VoltAgent/awesome-agent-skills/blob/main/CONTRIBUTING.md)) | PR titled `Add skill: canerinali/grep-first`, entry added at the end of the matching category | "Brand new skills that were just created are not accepted"; they want real community usage. Description of 10 words or fewer. Format: `- **[canerinali/grep-first](url)** - ...` | Late October, after visible adoption (issues or stars from people you don't know) |
| ComposioHQ/awesome-claude-skills | https://github.com/ComposioHQ/awesome-claude-skills ([CONTRIBUTING](https://github.com/ComposioHQ/awesome-claude-skills/blob/master/CONTRIBUTING.md)) | PR that adds the skill folder (with SKILL.md) to their repo plus a README line under **Development**, alphabetical | Must solve a real problem, include examples and be tested. Format: `- [Skill Name](./skill-name/) - One-sentence description.` MIT allows the copy; link back to the source repo | 2026-10-13 |

Ready descriptions:
- awesome-claude-code (one factual line): `A skill that makes Claude Code find each new external method, CLI flag or config key in the installed source and cite file:line, or mark it Unverified.`
- VoltAgent (10 words or fewer): `Verify external APIs in installed source before use; cite file:line.`
- awesome-codex-cli: `SKILL.md that makes Codex cite file:line from installed source before using an API, or say Unverified.`

Also set the GitHub topics in section 8 so the repo shows up on https://github.com/topics/claude-skills and https://github.com/topics/codex-skills (both topic pages exist).

### Related issues and discussions (found, for context)

Do not drop links into these threads. The issues below are closed and the HN threads are old enough to be archived. Use them as motivation in the dev.to post and the HN comment, and comment only if a thread is still open and the skill actually answers the question asked.

- anthropics/claude-code #72946, "[MODEL] Claude doesn't know its own CLI flags — users shouldn't have to teach it --resume" (closed as not planned): https://github.com/anthropics/claude-code/issues/72946. This is the CLI-flag case in grep-first's rule 3; the fix it asks for is "check `--help` before answering".
- phmatray/FormCraft #463, "docs: CLAUDE.md documents APIs that don't exist" (closed): https://github.com/phmatray/FormCraft/issues/463. Invented methods in an agent instruction file, which then became traps for the agent.
- HN, "Hallucinations in code are the least dangerous form of LLM mistakes": https://news.ycombinator.com/item?id=43233903. Its argument is that the compiler catches invented methods. grep-first's answer is the cases it doesn't catch (flags, env keys, dynamic code). Expect this objection in the Show HN thread.
- HN, "LLM Hallucinations in Practical Code Generation": https://news.ycombinator.com/item?id=44353241.
- arXiv 2607.12340, "Skills That Don't Exist: A Large-Scale Study of Hallucinated Skill…": https://arxiv.org/pdf/2607.12340. Adjacent (invented skill names, not APIs); useful as background only.

No open GitHub issue about agents inventing API methods turned up in searches of `openai/codex` or `anthropics/claude-code`. Search again before launch instead of assuming none exists.

---

## 5. Timing

US Eastern is UTC-4 in October 2026 (DST ends 2026-11-01), so 08:00 ET = 15:00 Türkiye.

| Date | Day | Channel | Time | Notes |
|---|---|---|---|---|
| 2026-10-01 | Thu | Push repo, set description and topics, record the hero GIF, embed it | any | No sharing yet. CI must be green on GitHub before anything is posted |
| 2026-10-02 | Fri | Run one real eval (`--agent claude`), commit `report.md`, and paste it verbatim into the results block if you want numbers at launch | any | Optional. Without it, launch says "no numbers yet" |
| 2026-10-05 | Mon | Soft check: ask 2-3 people you know to try the install line and open issues on anything confusing | any | Fix README friction before HN |
| **2026-10-06** | **Tue** | **Show HN** + first comment | **08:00-09:00 ET (15:00-16:00 TRT)** | Stay in the thread for the first 3-4 hours and answer everything |
| 2026-10-06 | Tue | X thread | 11:00 ET (18:00 TRT) | Link to GitHub, not to HN |
| 2026-10-07 | Wed | r/ClaudeAI (Built with Claude) | 09:00-10:00 ET (16:00-17:00 TRT) | |
| 2026-10-08 | Thu | LinkedIn (Turkish) | 08:30-09:30 TRT | Weekday morning for the Turkish audience |
| 2026-10-08 | Thu | dev.to post | 09:00 ET (16:00 TRT) | Include what you learned from HN comments |
| 2026-10-09 | Fri | r/ClaudeCode weekly showcase, r/ChatGPTCoding weekly self-promotion thread | whenever the thread is up | |
| 2026-10-13 | Tue | awesome-codex-cli (issue/PR), ComposioHQ/awesome-claude-skills (PR) | any | |
| 2026-10-13 | Tue | travisvn/awesome-claude-skills PR | any | Only if the repo has at least 10 stars. Write it by hand |
| **2026-10-14** | **Wed** | **hesreallyhim/awesome-claude-code issue form** | any | First eligible day (14 days). Needs commits after 2026-09-30 |
| 2026-10-20 | Tue | Second X post with anything new: first eval report, community trap cases, v0.1.1 | 11:00 ET | |
| 2026-10-27 | Tue | VoltAgent/awesome-agent-skills PR | any | Only if there is outside adoption by then |

If the Show HN gets no traction, do not resubmit the same link within days. HN allows a repost after a meaningful change (for example a published eval report), or you can ask the mods at hn@ycombinator.com about the second-chance pool.

---

## 6. Post-release checklist (for the maintainer)

- [ ] `git config user.email` inside the repo shows the personal noreply address (`32527189+canerinali@users.noreply.github.com`; all current commits use it). Never a work address.
- [ ] Create and push the repo yourself (the automated push was blocked before):
  ```sh
  cd ~/oss-factory/projects/grep-first
  gh repo create canerinali/grep-first --public --source . --push \
    --description 'Makes Claude Code and Codex cite file:line from the installed source before using an API, or say "Unverified".'
  gh repo edit canerinali/grep-first --add-topic claude-code,codex,agent-skills,claude-skills,hallucination,developer-tools
  ```
- [ ] CI is green on GitHub Actions. After that, you can add the CI badge under `<!-- badges -->`: `![CI](https://github.com/canerinali/grep-first/actions/workflows/ci.yml/badge.svg)`.
- [ ] Record the demo GIF: `npm ci --prefix evals/fixture && vhs .github/readme/demo.tape`, then embed `.github/readme/demo.gif` at the `<!-- demo -->` comment in README.md, and below the three bullets in each translation (there the path is just `demo.gif`, since the translations are in the same folder). Run `npm test && npm run links`.
- [ ] Upload a social preview image (Settings → Social preview): one frame of the GIF, 1280×640.
- [ ] Optional: one real eval run, `npx tsx evals/run.ts --agent claude --timeout 180`. Commit the `report.md` and paste it verbatim between the results markers (`test/readme.test.ts` accepts only a verbatim committed report).
- [ ] **First share: Show HN, Tuesday 2026-10-06, 08:00-09:00 ET (15:00-16:00 TRT).** Then follow section 5.
- [ ] Pin the repo on your GitHub profile.
- [ ] Turn each good trap case from comments into an issue labeled `eval-case`. It shows activity, and awesome-claude-code requires that.

---

## 7. Packaging checklist (model: ayghri/i-have-adhd)

| Item | Status | Notes |
|---|---|---|
| a. Before/after on the first screen | Done | Two code blocks right below the three bullets: the invented `findOneAndUpsert` call, then the `Unverified`/`Verified` lines and the fixed code. I didn't use a side-by-side table because multi-line fenced code doesn't render inside GitHub Markdown tables, and the blocks would turn into unreadable inline code. The label "Illustrative" stays; the test requires it |
| b. One-line install | Done | README line 2 has a sentence to paste into Claude Code or Codex (same pattern as i-have-adhd: "install from <repo>, follow INSTALL.md") and one shell command. New [`INSTALL.md`](INSTALL.md) holds agent-followable steps, a target table (Claude Code, Codex, AGENTS.md; user or project level), a check prompt, update and uninstall. README keeps a short four-line install block because the tests and the eval docs refer to those paths |
| c. Memorable name | Keep "grep-first" | See below |
| d. Multilingual README | Done | [`.github/readme/README.tr.md`](.github/readme/README.tr.md), [`README.zh-CN.md`](.github/readme/README.zh-CN.md), [`README.es.md`](.github/readme/README.es.md), [`README.pt-BR.md`](.github/readme/README.pt-BR.md), with a language bar at the top of each file and of README.md (line 5, because lines 1-3 are pinned by the test). Code blocks and program output stay in English, byte for byte, since they are real output. The translations have no results markers: they point to the English README for numbers, so a translation can never carry stale or hand-typed metrics. i-have-adhd also has Japanese, Korean, Vietnamese, Persian, Thai and Arabic; add those only if people who speak them can review them |
| e. Short rule/feature list | Done | "Features" has 9 one-line items (`test/readme.test.ts` enforces at most 10 and requires the section to hold only list lines). The three first-screen bullets are the short version |

What is still missing from the README, and why:
- **Demo GIF:** it has to be recorded on a machine with `vhs` (not installed here). The tape is ready and the README has a placeholder comment.
- **Stars and CI badges:** the repo is not public yet, so they would render as broken images. Add the CI badge after the first green run (see section 6). Only static badges are there for now.

### Is "grep-first" catchy?

Mostly yes, for the audience that matters here. It is short, it reads as a rule ("grep first, then write code"), every developer knows `grep`, it is free on npm (404 on 2026-09-30), and no GitHub repo with the same purpose showed up (the closest name, `mrblackman/git-grep-first-for-windows-ai-agent`, is about search speed). Weaknesses: it sounds like a search tool (for example next to BeaconBay/ck, a "semantic grep"), it doesn't say "hallucination" or "verify", the skill also uses `tsc`, LSP and `--help` rather than only grep, and non-developers on LinkedIn won't get it. The tagline and the `Unverified` hook carry the meaning, so keep the name.

Three alternatives, for reference only (do not rename):
1. **no-phantom-api**: says the problem outright; npm 404 and no same-purpose GitHub repo in a quick search (2026-09-30).
2. **show-me-the-source**: a familiar phrase that fits the file:line receipt; npm 404, no same-purpose GitHub repo in a quick search.
3. **cite-the-source**: plain and descriptive; npm 404, though `langchain-ai/weblangchain` uses similar wording for web citations.

I rejected `prove-it` because `searlsco/prove_it` is an existing Claude Code verification harness. Before using any of these names, also check the npm tombstone: an npm 404 can hide an unpublished name whose old version numbers are permanently blocked.

---

## 8. GitHub topics

`claude-code`, `codex`, `agent-skills`, `claude-skills`, `hallucination`, `developer-tools`

`claude-skills` and `codex-skills` both have topic pages that awesome-list visitors browse. `codex-skills` is a reasonable swap for `developer-tools` if you want to stay at six. `package.json` keywords already include `claude-code`, `codex`, `skill`, `hallucination` and `ai-agents`.
