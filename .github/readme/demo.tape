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
