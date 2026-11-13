# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/) on a best-effort basis while in `0.x`.

## [0.3.0] - 2026-11-13

### Fixed
- `buildIndex` contained a literal raw NUL byte (0x00) inside its own binary-file check, which caused `src/core.js` to match itself as "binary" and be permanently excluded from its own search index — so searches for how its functions work could only ever find documentation mentions, never the real implementation. Replaced with the proper `\0` escape.
- `saveIndex`/`loadIndex` wrote to a leftover `.tokenshield/` path from the pre-rename name instead of `.contextsquirrel/`, which also meant the index file wasn't covered by `.gitignore`.
- Search ranking padded results up to the token budget with low-relevance filler files; it now scores symbol *definitions* above prose mentions and drops files that aren't meaningfully close to the top match. Measured on this repo's ground-truth benchmark: hit rate 60% → 100%, average token reduction on hits -86.3% → +30.5%.

### Added
- `extractTestFailures` / `contextsquirrel test-failures` / `contextsquirrel_test_failures`: condenses jest/pytest/go-test-style output to failure blocks + pass/fail count.
- `summarizeDiff` / `contextsquirrel diff-summary` / `contextsquirrel_diff_summary`: compresses a unified git diff to per-file +/- stats and the changed lines, dropping unchanged context.
- `repoTree` / `contextsquirrel tree` / `contextsquirrel_repo_tree`: compact directory tree with each file's top symbols, from the existing index.
- `summarizeStructure` / `contextsquirrel json-summary` / `contextsquirrel_json_summary`: reduces large JSON to its shape (keys/types, array length + one sampled element).
- `scripts/real-benchmark.mjs`: a ground-truth benchmark (does search find the file that answers the query, and at what token cost) to replace the synthetic benchmark's numbers with measured ones.
- `contextsquirrel version` / `--version` / `-v`.

### Changed
- README's feature comparison replaced with real before/after token numbers per transform, each labeled as a single representative example rather than a guaranteed result.

## [0.2.0] - 2026-11-13

### Added
- `/squirrel` Claude Code slash command (skill) with `on`/`off`/`status` sub-actions.
- Project-scoped Safe Mode state persisted to `.contextsquirrel/mode.json`.
- `install.sh` / `scripts/install-claude.mjs` global installer for Claude Code.

### Changed
- **Renamed the project from TokenShield to ContextSquirrel** 🐿️ — same tool, friendlier name. CLI binary, MCP tool names (`contextsquirrel_search` etc.), env var (`CONTEXTSQUIRREL_ROOT`), and state directory (`.contextsquirrel/`) all follow.
- Reformatted all source files (`src/`, `bin/contextsquirrel.js`) for readability; no behavior changes.
- Synced version numbers across `package.json`, the Claude/Codex plugin manifests, and the MCP server info.

## [0.1.0] - 2026-11-13

### Added
- Initial developer preview: local file indexing, keyword-ranked search, safe build-log compression, exact-duplicate paragraph removal.
- MCP stdio server exposing search, log-compression, dedupe, and reindex tools.
- Claude Code / Codex / Antigravity integration examples.
- Unit tests and a synthetic log-compression benchmark.
