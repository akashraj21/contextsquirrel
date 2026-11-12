# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/) on a best-effort basis while in `0.x`.

## [0.2.0] - 2026-11-13

### Added
- `/tokenshield` Claude Code slash command (skill) with `on`/`off`/`status` sub-actions.
- Project-scoped Safe Mode state persisted to `.tokenshield/mode.json`.
- `install.sh` / `scripts/install-claude.mjs` global installer for Claude Code.

### Changed
- Reformatted all source files (`src/`, `bin/tokenshield.js`) for readability; no behavior changes.
- Synced version numbers across `package.json`, the Claude/Codex plugin manifests, and the MCP server info.

## [0.1.0] - 2026-11-13

### Added
- Initial developer preview: local file indexing, keyword-ranked search, safe build-log compression, exact-duplicate paragraph removal.
- MCP stdio server exposing `tokenshield_search`, `tokenshield_compress_log`, `tokenshield_dedupe`, `tokenshield_reindex`.
- Claude Code / Codex / Antigravity integration examples.
- Unit tests and a synthetic log-compression benchmark.
