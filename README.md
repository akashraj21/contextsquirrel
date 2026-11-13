# 🐿️ ContextSquirrel

**Your AI coding assistant's little helper for not reading your whole repo every time.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)

Squirrels don't drag the whole tree home. They grab the good acorns and bury
the rest. That's the whole idea here: instead of your AI assistant reading
entire files and pasting 5,000-line build logs into its brain, ContextSquirrel
hands it just the good bits — a few relevant snippets, the important lines
from a crashed build, no copy-pasted duplicate paragraphs.

It's **free, local-only, zero-dependency Node.js**. No sign-up, no API key,
no "AI cloud" middleman reading your code. Just a tiny script that reads
your own files on your own machine.

> **Honest label on the tin:** this is a v0.2.0 preview. It helps your
> assistant fetch smaller, smarter chunks of context — it does **not**
> intercept your AI provider's requests, and we're not going to tell you
> it saves some magic 70% of tokens until we've actually measured that
> end-to-end. More on that below. 👇

---

## What does it actually do?

Each transform takes some noisy input and keeps only what answers the question. Numbers below are from real runs on representative example inputs (estimated tokens, bytes÷4 — not provider-billed tokens, not a guarantee for your specific files):

| Command | What it keeps | Example: before → after | Reduction |
|---|---|---|---|
| `search` | Symbol definitions ranked above files that just mention the name, not a flat grep | ground-truth benchmark: 100% hit rate | ~30% avg on hits* |
| `compress` | Start, end, every error/warning + context; drops the repetitive middle | 5,393 → 122 tokens | 97.7% |
| `test-failures` | Only FAIL/panic/traceback blocks + a pass/fail count; passing-test noise dropped | 2,093 → 41 tokens | 98.0% |
| `diff-summary` | Per-file +/- stats and the actual changed lines; unchanged context dropped | 339 → 12 tokens | 96.5% |
| `tree` | Directory layout + each file's top symbols, instead of opening every file | 13,534 → 158 tokens | 98.8% |
| `json-summary` | Shape only — keys/types, array length, one sampled element | 23,948 → 52 tokens | 99.8% |
| `dedupe` | Exact-duplicate paragraphs removed, kept once | 115 → 44 tokens | 61.7% |

\* See `scripts/real-benchmark.mjs` — the only row here checked against ground truth (did it find the right file, not just "is the output smaller"). Run it against your own repo for your own numbers; don't take the other rows' percentages as a guarantee on your files either — they're from one example input each, not an average across many.

7 local, zero-dependency transforms. No prompt rewriting, no billing tricks, no secret sauce.

---

## Install it — pick your path

### 🟢 Path 1: You use Claude Code (VS Code extension) — easiest

```bash
git clone https://github.com/akashraj21/contextsquirrel.git
cd contextsquirrel
bash install.sh
```

Restart Claude Code / VS Code, open any project, and in the **Claude Code
chat** type:

```text
/squirrel
```

That's it — Safe Mode is on for that project. Turn it off anytime with
`/squirrel off`, or check `/squirrel status`. No terminal needed after
the first install.

<details>
<summary>What did that installer just do?</summary>

- Copied the app to `~/.contextsquirrel/app`
- Installed the `/squirrel` skill to `~/.claude/skills/squirrel/`
- Added one SessionStart hook to `~/.claude/settings.json` (and backed up
  your existing settings first)
- Didn't touch any other hooks or settings you already had

</details>

### 🟡 Path 2: You use Claude Code, Codex, Antigravity, or anything that speaks MCP

Run ContextSquirrel as an MCP server and point your assistant at it:

```bash
git clone https://github.com/akashraj21/contextsquirrel.git
node /absolute/path/to/contextsquirrel/bin/contextsquirrel.js mcp
```

Then register it with your tool. Copy `examples/mcp_config.example.json`
and swap in your real paths:

```json
{
  "mcpServers": {
    "contextsquirrel": {
      "command": "node",
      "args": ["/absolute/path/to/contextsquirrel/bin/contextsquirrel.js", "mcp"],
      "env": { "CONTEXTSQUIRREL_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

**Claude Code CLI:**
```bash
claude mcp add contextsquirrel --env CONTEXTSQUIRREL_ROOT=/absolute/path/to/repo -- node /absolute/path/to/contextsquirrel/bin/contextsquirrel.js mcp
```

**Codex CLI:**
```bash
codex mcp add contextsquirrel --env CONTEXTSQUIRREL_ROOT=/absolute/path/to/repo -- node /absolute/path/to/contextsquirrel/bin/contextsquirrel.js mcp
```

**Google Antigravity:** open **MCP Servers → Manage MCP Servers → View raw
config** and adapt `integrations/antigravity/mcp_config.example.json`.

This hands your assistant 8 tools it can call on its own:
`contextsquirrel_search`, `contextsquirrel_compress_log`,
`contextsquirrel_dedupe`, `contextsquirrel_reindex`,
`contextsquirrel_test_failures`, `contextsquirrel_diff_summary`,
`contextsquirrel_repo_tree`, `contextsquirrel_json_summary`.

### 🔵 Path 3: You just want the CLI, no assistant integration

```bash
git clone https://github.com/akashraj21/contextsquirrel.git
cd contextsquirrel
npm test                                  # make sure everything's happy

CONTEXTSQUIRREL_ROOT=/path/to/your/project node bin/contextsquirrel.js index
CONTEXTSQUIRREL_ROOT=/path/to/your/project node bin/contextsquirrel.js search "session authentication"
node bin/contextsquirrel.js compress /path/to/build.log
node bin/contextsquirrel.js dedupe notes.txt
node bin/contextsquirrel.js test-failures /path/to/test-output.log
git diff | node bin/contextsquirrel.js diff-summary
CONTEXTSQUIRREL_ROOT=/path/to/your/project node bin/contextsquirrel.js tree
node bin/contextsquirrel.js json-summary /path/to/data.json
node bin/contextsquirrel.js benchmark
node scripts/real-benchmark.mjs /path/to/your/project   # ground-truth search accuracy + token numbers
```

Want it installed as a global `contextsquirrel` command instead of typing
the full path every time?

```bash
npm install -g .
contextsquirrel search "session authentication"
```

**Windows (PowerShell) users:** set the env var like this instead:
```powershell
$env:CONTEXTSQUIRREL_ROOT = 'C:\path\to\your\project'
```

**Requirements for every path:** [Node.js](https://nodejs.org) 20 or newer.
That's the whole dependency list — seriously, check `package.json`, there
isn't one.

---

## What's actually implemented today

- 📂 Local file indexing — skips secrets, `node_modules`, build output, symlinks, anything huge
- 🔍 Keyword-ranked search over that index, with symbol definitions outranking mere mentions, and a token budget cap that doesn't pad results with low-relevance filler
- 🪵 Build-log compression that keeps every error/warning + surrounding context, and safely bails out to the original log if that critical content is too big to trust a summary
- 🧪 Test-failure extraction — condenses jest/pytest/go-test/etc. output to just the failing blocks and a pass/fail count
- 🔀 Diff summarization — compresses a unified git diff to per-file +/- stats and the actual changed lines, dropping unchanged context
- 🌳 Repo tree — a compact directory listing with each file's top symbols, built from the same index as search
- 📦 JSON shape summary — for large JSON files, returns keys/types and one sampled array element instead of the whole file
- 🧹 Exact-duplicate-paragraph removal
- 🔌 An MCP server exposing all of the above as callable tools
- ✅ Unit tests (`npm test`) and a synthetic benchmark (`contextsquirrel benchmark`)

## What it is *not* (so nobody's surprised later)

- It does **not** intercept or rewrite your requests to Claude/OpenAI/whoever.
- It does **not** change your model billing.
- The `benchmark` command tests synthetic log compression only — it is
  **not** a measurement of real end-to-end token savings.
- `scripts/real-benchmark.mjs` is a small, honest measurement: 5 hand-verified
  "does search surface the file that actually answers this?" queries against
  this repo, comparing search output tokens to reading the correct file in
  full. Current result on this repo: **100% hit rate, ~30% average token
  reduction on hits** (estimated tokens, not provider-billed tokens). A few
  cases come out roughly break-even — small files and queries where two
  files are both genuinely relevant don't always save tokens, and that's
  reported honestly rather than smoothed over. This is a small, repo-local
  sample, not a universal claim — run `node scripts/real-benchmark.mjs
  /path/to/your/repo` to see your own numbers.
- It is **not** a secret scanner. `.env`/credential-looking paths are
  excluded from indexing on a best-effort basis — don't rely on it as your
  only safeguard.
- Search results are partial excerpts. Read the full file before editing
  based on a snippet.

## Privacy, in one breath

No telemetry. No network calls. No paid model. Everything happens on your
machine, reading your own files. The only thing it writes is a small index
file at `.contextsquirrel/index.json` (metadata and hashes, not your source
code) — add `.contextsquirrel/` to your `.gitignore`.

## Updating

Check what you have installed:
```bash
node ~/.contextsquirrel/app/bin/contextsquirrel.js version
```
Compare against the latest tag at
https://github.com/akashraj21/contextsquirrel/releases — then update
using whichever path you installed with:

- **Path 1 (Claude Code installer):** pull the latest code in your cloned
  copy and re-run the installer — it overwrites `~/.contextsquirrel/app`
  in place:
  ```bash
  cd contextsquirrel && git pull && bash install.sh
  ```
- **Path 2 (MCP server by path):** just `git pull` in the cloned repo your
  MCP config points at — no config change needed, the next server start
  picks it up.
- **Path 3 (global npm install):** pull, then reinstall:
  ```bash
  cd contextsquirrel && git pull && npm install -g .
  ```

There's no auto-update check — this tool makes no network calls, including
to check its own version, so checking for updates is a manual step on
purpose.

## Uninstalling

```bash
rm -rf ~/.claude/skills/squirrel ~/.contextsquirrel/app
```
Then remove the ContextSquirrel entry from the `SessionStart` section of
`~/.claude/settings.json`.

## Project layout

```
bin/contextsquirrel.js      the CLI (on|off|status|index|search|compress|dedupe|test-failures|diff-summary|tree|json-summary|benchmark|mcp)
src/core.js                  indexing, search, log compression, test-failure extraction, diff summary, repo tree, json shape summary, dedupe
src/mcp.js                   the MCP server
src/mode.js                  per-project Safe Mode on/off state
integrations/                Claude Code skill + plugin, Codex plugin, Antigravity example
scripts/install-claude.mjs   what install.sh actually runs
scripts/real-benchmark.mjs   ground-truth search accuracy + token benchmark (not synthetic)
tests/                        npm test lives here
```

## Roadmap

1. A real tokenizer (not the bytes/4 guess we use today) + a persistent benchmark harness
2. Smarter, AST-aware retrieval instead of keyword matching
3. Real compatibility testing across Claude Code / Codex / Antigravity
4. A transparent savings dashboard, once we have real numbers to show

## Contributing

PRs and issues welcome! We keep this project deliberately small — zero
runtime dependencies, no telemetry, no inflated performance claims. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the ground rules and
[CHANGELOG.md](CHANGELOG.md) for what's shipped so far.

MIT licensed — see [LICENSE](LICENSE). Go build something fun with it. 🐿️
