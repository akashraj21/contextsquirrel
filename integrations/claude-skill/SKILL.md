---
name: tokenshield
description: Toggle TokenShield Safe Mode in this Claude Code project, or check status. Invoke explicitly with /tokenshield, /tokenshield off, /tokenshield on, /tokenshield status.
disable-model-invocation: true
argument-hint: "[on|off|status]"
---

TokenShield is a **project-scoped, advisory safe context optimization mode**. It does NOT intercept Claude requests or guarantee savings.

When this skill is invoked, inspect `$ARGUMENTS` (trim whitespace and lowercase):

- Empty or `on`: use the Bash tool to run `node "$HOME/.tokenshield/app/bin/tokenshield.js" on` with the current project working directory.
- `off`: use the Bash tool to run `node "$HOME/.tokenshield/app/bin/tokenshield.js" off` with the current project working directory.
- `status`: use the Bash tool to run `node "$HOME/.tokenshield/app/bin/tokenshield.js" status` with the current project working directory.
- Any other argument: briefly explain usage `/tokenshield`, `/tokenshield off`, `/tokenshield status` without running a command.

Do not execute the toggle in the TokenShield installation directory; it must run in the user's open project root (the current Claude Code working directory). If the Bash tool is unavailable, tell the user how to run the same command in VS Code Terminal; do not claim activation succeeded.

Only after a successful `on` command, apply these rules to the current Claude Code conversation:

1. Search only the relevant portions of files; don't dump full directories or unchanged files without need.
2. Limit verbose exploratory logs while preserving all warnings, errors, failed tests, and debugging context.
3. Never trim required code, user requirements, API contracts, security constraints, or answers to meet a token budget.
4. If context is insufficient, access the complete source and prioritize correctness.
5. Avoid repeated analysis of already verified unchanged information.
6. Complete the user's work normally; TokenShield should not change the expected quality or depth of responses.

The project setting is persisted in `.tokenshield/mode.json`. A SessionStart hook applies the preference to future Claude Code sessions. If `off`, stop following TokenShield-specific instructions. Always accurately state that only **advisory Safe Mode** is enabled and that end-to-end token savings haven't been verified.
