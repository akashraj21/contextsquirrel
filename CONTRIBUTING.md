# Contributing to ContextSquirrel 🐿️

Thanks for considering a contribution. ContextSquirrel is a small, zero-dependency
Node.js tool, and we'd like to keep it that way — please read this before
opening a PR.

## Ground rules

- **No runtime dependencies.** The project ships as plain Node.js 20+ with no
  `node_modules` at runtime. Don't add a package unless there's no reasonable
  way to avoid it, and discuss it in an issue first.
- **No telemetry, no network calls.** ContextSquirrel is local-only by design.
  Any change that phones home will be rejected.
- **Don't inflate the savings story.** The `benchmark` command measures
  synthetic log compression only, not end-to-end model token usage. Please
  don't add marketing language or unverified performance claims to docs or
  commit messages — see the Performance Claims section of the README.

## Getting set up

```bash
git clone <your fork>
cd contextsquirrel
npm test
```

There's no build step. `bin/contextsquirrel.js` runs directly against `src/`.

## Making a change

1. Open an issue first for anything beyond a small fix, so we can agree on
   the approach before you write code.
2. Keep changes scoped — this is a small codebase; avoid unrelated reformatting
   or refactors mixed into a bug fix or feature PR.
3. Add or update tests under `tests/` for any behavior change. **Include a
   failing test when fixing a bug** so we can see it reproduce before the fix.
4. Run `npm test` and make sure it's green before opening the PR.
5. Update `CHANGELOG.md` under an `Unreleased` section.

## Reporting issues

Please include:
- ContextSquirrel version (`node bin/contextsquirrel.js status` or `--version` if available)
- Node.js version (`node --version`)
- Exact command run and full output
- Whether the issue reproduces with a fresh `.contextsquirrel/` index (`contextsquirrel index`)

## Security

If you find a path-traversal, symlink, or secret-exposure issue in the
indexer (`src/core.js`'s `safeProjectFile`/`walk`), please open an issue
directly rather than a public PR with exploit details, so we can patch
before disclosure.
