# ContextSquirrel 🐿️ — your AI coding assistant's context sidekick

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)

**Status: v0.2.0 developer preview — not a proven 60–70% savings product.**

Squirrels don't haul the whole tree home — they grab the good acorns and
bury the rest. ContextSquirrel does the same thing for your AI coding
assistant: instead of dumping entire files and walls of build-log noise
into the model's context window, it fetches small, relevant excerpts,
shrinks verbose logs down to the lines that actually matter, and throws
out exact duplicate paragraphs.

It's **zero-dependency Node.js (20+)**, cross-platform, local-only by
default, and MIT-licensed. No account, no API key, no payment, no
"AI optimization cloud" — just a small script reading your own files.

## What it actually does, in plain terms

| You ask the assistant to...           | Without ContextSquirrel                              | With ContextSquirrel                                                   |
|----------------------------------------|--------------------------------------------------------|---------------------------------------------------------------------------|
| "Where is `verifySession` defined?"    | Reads whole files one by one hoping to find it          | Searches a local index, returns a handful of line-numbered snippets        |
| "Why did the build fail?"              | Pastes 5,000 lines of CI log into context                | Keeps the head, tail, and lines around every error/warning; drops the rest |
| "Summarize these three log dumps"      | Processes the same repeated boilerplate paragraph 3x    | Strips exact duplicate paragraphs before they're processed                 |

That's it. It doesn't rewrite your prompts, it doesn't intercept your model
calls, and it doesn't touch any provider's billing. It's a local helper
tool the assistant can *choose* to call via MCP, or a project setting that
reminds Claude Code to search smart instead of dumping everything.

## Quick start

```bash
cd contextsquirrel
npm test
CONTEXTSQUIRREL_ROOT=/path/to/your/project node bin/contextsquirrel.js index
CONTEXTSQUIRREL_ROOT=/path/to/your/project node bin/contextsquirrel.js search "session authentication"
node bin/contextsquirrel.js benchmark
node bin/contextsquirrel.js compress /path/to/build.log
```

On Windows PowerShell, set `$env:CONTEXTSQUIRREL_ROOT='C:\\path\\to\\project'` before commands.

## Contents

- [What it actually does](#what-it-actually-does-in-plain-terms)
- [Quick start](#quick-start)
- [What is actually implemented?](#what-is-actually-implemented)
- [Integrate via MCP](#integrate-via-mcp-recommended)
- [Claude Code slash-command Safe Mode](#claude-code-slash-command-safe-mode)
- [Project structure](#project-structure)
- [Privacy and correctness](#privacy-and-correctness)
- [Performance claims](#performance-claims)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

## What is actually implemented?

- Index local source files, excluding typical secrets, ignored vendor directories, huge files and symlinks.
- Keyword/ranked source excerpt search with line numbers, SHA-256 validation and token-budget caps.
- Safe heuristic build-log compression that preserves critical diagnostic lines and nearby context, or returns unmodified input if important material is too large.
- Exact duplicate paragraph removal.
- MCP stdio tools: `contextsquirrel_search`, `contextsquirrel_compress_log`, `contextsquirrel_dedupe`, `contextsquirrel_reindex`.
- Example Claude Code and Codex session-start plugin configuration, plus an Antigravity MCP configuration example.
- Automated unit tests and a **synthetic tool-output** benchmark.

## Integrate via MCP (recommended)

Run `node /absolute/path/to/contextsquirrel/bin/contextsquirrel.js mcp` with environment variable `CONTEXTSQUIRREL_ROOT` set to your repository. Configure your coding assistant's MCP server entry using `examples/mcp_config.example.json`; replace all placeholder absolute paths. The executable speaks MCP JSON-RPC over newline-delimited stdio. It never connects to an external API.

### Claude Code

Use your Claude Code MCP integration to register the server. One possible CLI setup (confirm against your installed version):

```bash
claude mcp add contextsquirrel --env CONTEXTSQUIRREL_ROOT=/absolute/path/to/repository -- node /absolute/path/to/contextsquirrel/bin/contextsquirrel.js mcp
```

A separate opt-in **SessionStart-only advisory** plugin example lives in `integrations/claude-plugin/`. The plugin does **not** rewrite provider prompts, automatically compress all tools, or change model billing. Validate plugin installation steps with your Claude Code release.

### Codex

Register the same server using the Codex MCP configuration or CLI, for example:

```bash
codex mcp add contextsquirrel --env CONTEXTSQUIRREL_ROOT=/absolute/path/to/repository -- node /absolute/path/to/contextsquirrel/bin/contextsquirrel.js mcp
```

An opt-in Codex SessionStart advisory plugin example is under `integrations/codex-plugin/`. Native hook packaging and trust requirements vary by Codex version; inspect `/hooks` and confirm the plugin is enabled.

### Google Antigravity

Open **MCP Servers → Manage MCP Servers → View raw config**, then adapt `integrations/antigravity/mcp_config.example.json`. This registers ContextSquirrel as an optional **MCP tool**, not a request interceptor.

## Claude Code slash-command Safe Mode

ContextSquirrel ships a global **`/squirrel`** command for Claude Code (including the VS Code Claude Code extension). It is a Claude Code **skill** and an advisory SessionStart hook, NOT an automatic prompt interceptor. Real token savings have not been benchmarked.

### Install once on macOS / Linux

```bash
cd ~/Downloads/contextsquirrel
bash install.sh
```

The installer copies the app to `~/.contextsquirrel/app`, installs `~/.claude/skills/squirrel/SKILL.md`, and merges a single SessionStart hook into `~/.claude/settings.json`. It backs up existing settings. Restart Claude Code in VS Code, open any project, and in **Claude Code chat** (not Terminal) type:

```text
/squirrel
/squirrel status
/squirrel off
```

The state is stored at `YOUR_PROJECT/.contextsquirrel/mode.json`; add `.contextsquirrel/` to your project's `.gitignore` if desired. Only the selected project is enabled. The command runs through Claude's Bash tool; approve the request if prompted. Claude Code Desktop chat (non-Code) does not support this workflow.

CLI alternative from a project directory:

```bash
node "$HOME/.contextsquirrel/app/bin/contextsquirrel.js" on
node "$HOME/.contextsquirrel/app/bin/contextsquirrel.js" status
node "$HOME/.contextsquirrel/app/bin/contextsquirrel.js" off
```

To remove the integration manually, delete `~/.claude/skills/squirrel/`, remove the ContextSquirrel SessionStart entry from `~/.claude/settings.json`, and delete `~/.contextsquirrel/app`. Other hooks and settings should remain untouched.

## Project structure

```
bin/contextsquirrel.js      CLI entrypoint (on|off|status|index|search|compress|dedupe|benchmark|mcp)
src/core.js                  Indexing, search, log compression, dedupe, token estimation
src/mcp.js                   MCP stdio server (tools/list, tools/call)
src/mode.js                  Project-scoped Safe Mode state (.contextsquirrel/mode.json)
integrations/                Claude Code skill + plugin, Codex plugin, Antigravity MCP example
scripts/install-claude.mjs   Global installer used by install.sh
tests/                        node:test unit tests
examples/                     Example MCP client configuration
```

## Privacy and correctness

- Default: no telemetry, no network calls, no paid model.
- `.env` and typical credentials excluded from indexing; check project-specific secret formats before any use. This is not a comprehensive secret detector.
- Source search returns partial excerpts. Before editing, read complete relevant files using your normal tools.
- Log compression is *lossy* for successful lines. When precise logs matter, use the original log.
- Token estimates use bytes/4, **not provider tokenizers or billable usage**. Unicode and code can diverge significantly.
- Index metadata is saved under `.contextsquirrel/index.json` (source code is not stored in the index). Ignore this directory in Git.
- The MCP server only reads project files and writes its own index when requested; no shell execution and no file-edit MCP tool.

## Performance claims

Our long-term research target is **60–70% lower end-to-end token usage in suitable workflows**, with equal task correctness. **No such performance is claimed by v0.2.0.** The included `benchmark` command only tests synthetic log-output compression. End-to-end savings require controlled experiments across Claude/Codex/Antigravity with measured total usage, retries, model cache accounting, tool calls and task-completion rates.

## Roadmap

1. Real tokenizer support and persistent benchmark harness with task fixtures.
2. AST-aware retrieval, semantic indexing and incremental hashing.
3. Real-world plugin integration validation and compatibility CI.
4. Optional visual metrics dashboard, user consent and transparent reporting.

## Contributing

Open issues and PRs. Please include failing tests when fixing bugs and avoid benchmark claims without reproducible evidence. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and ground rules, and [CHANGELOG.md](CHANGELOG.md) for release history.
