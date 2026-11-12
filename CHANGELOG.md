# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/) on a best-effort basis while in `0.x`.

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
