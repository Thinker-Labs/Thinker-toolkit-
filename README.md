# Thinker Toolkit

Engineering instructions for AI-assisted development, with an explicit TypeScript/npm verification command. Thinker writes project files. It does not install an editor extension, enforce model behavior, create agents or manage worktrees.

## Install and try

Requires Node.js 18+ for the CLI. Development/tests require Node.js 20+.

```sh
# Run inside the project you want to configure
npx thinker-toolkit@0.2.1 init

# Or install the CLI globally from npm
npm install -g thinker-toolkit@0.2.1
thinker init
```

Published on npm as [thinker-toolkit](https://www.npmjs.com/package/thinker-toolkit). Commands above pin version 0.2.1 for reproducible setup. Omit the version only when you intend to use the latest release.

Run setup in a trusted project. Installation and npm tools can access the network. Review the generated diff and backups before accepting changes.

## Development preview: project checks and receipts

Main now includes unreleased `check`, `receipt` and `doctor` commands plus shared instruction adapters and a composite Action. The npm version is still 0.2.1. See [review receipts](docs/review-receipts.md) and [Action/adapters](docs/action-and-adapters.md). Run `npm run demo` after building for a disposable failure/fix/stale walkthrough. Do not describe this preview as a released 0.3 or a proven team deployment.

## Commands

| Command | Behavior |
| --- | --- |
| `thinker init` | Detect existing editor configurations; ask for targets only when none is detected. |
| `thinker init --yes` | Skip selection; use detected targets, or Cursor and Claude when none is detected. |
| `thinker integrate --target claude` | Configure one target. Other targets: cursor, vscode, windsurf, antigravity. |
| `thinker integrate --target claude --overwrite` | Explicitly replace the entire target, still keeping a versioned backup. |
| `thinker list` | Print the four bundled protocol descriptions. |
| `thinker verify` | Run the two required checks below, then informational Git status. Failure returns a nonzero process exit. |
| `thinker verify --strict` | Same required-failure behavior as the default. Kept for compatibility. |
| `thinker verify --lenient` | Report failures but permit exit code zero. Do not use as a required CI gate. |

## Files and safe updates

| Target | File |
| --- | --- |
| claude | `CLAUDE.md` |
| cursor | `.cursorrules` |
| windsurf | `.windsurfrules` |
| antigravity | `.gemini/rules/thinker.md` |
| vscode | `.vscode/settings.json` |

Markdown setup manages a block between `<!-- thinker-toolkit:start -->` and `<!-- thinker-toolkit:end -->`. Existing content outside it is preserved. Repeating setup with no changes is a no-op. Existing pre-marker rule files are preserved and get a managed block appended; review duplicate older Thinker instructions manually before removing any.

Existing strict-JSON VS Code settings retain unrelated preferences, including format-on-save and TypeScript SDK choices. Only `thinker.*` keys are updated. Those keys are metadata, not executable instructions or an installed extension. New VS Code files include the template's default editor settings. Existing JSONC/comments are refused without changing the file. Merge manually or use explicit `--overwrite` only after reviewing the replacement.

Every changed existing file gets a new backup: `.bak`, `.bak.1`, `.bak.2`, and so on. Previous backups are never overwritten. Setup writes through a same-directory temporary file and rename, and refuses symlink targets/ancestors. This protects against accidental path following, not against another hostile process racing filesystem changes. A multi-target run is not a transaction: successes remain if another target fails, and the process reports incomplete setup with exit code 1.

There is no uninstall/restore command. Restore the version you intend from Git or a reviewed backup. Do not blindly delete generated files containing your own edits. Global package removal does not undo files written to projects.

## What verify checks

1. `npx --no-install tsc --noEmit`, with output visible. It does not fetch a missing TypeScript compiler.
2. `npm test -- --run`, with output visible. Your project must provide a compatible test script.
3. `git status --porcelain`, informational only. A dirty tree or unavailable Git is not a required-check failure.

A failed or timed-out types/test command returns exit code 1 unless `--lenient` was explicitly selected. Each check has a two-minute timeout. Passing these commands is not a safe-shipping guarantee. Lint, build, other languages and package managers, coverage policy and CI branch protection remain your project's responsibility. Framework detection during setup does not change the verification commands. Commands run project code with your current permissions, so do not verify untrusted projects blindly.

## Protocols

- Systematic debugging: hypothesis, reproduction, root-cause evidence and regression coverage.
- Test-driven development: observe a focused failing test, implement, rerun, then refactor.
- Verification before completion: gather actual check output before claiming completion.
- Worktree isolation: separate independent tasks using ordinary Git worktrees and review merges.

These are instructions. They cannot guarantee compliance, prevent conflicts or supply a security sandbox. Native editor support for legacy rule-file formats can change; check your editor version.

## Development and checks

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run smoke
npm audit
```

Tests use isolated temporary directories. The smoke check packs locally, installs the artifact into a temporary consumer, checks CJS/ESM entrypoints and CLI setup/repeat setup. It does not publish. CI runs on Linux, macOS and Windows with Node.js 20/22. Development dependency upgrades are pinned by the lockfile.

## v0.2 compatibility notes

- Verification failures now fail by default. Use `--lenient` only when a zero exit despite failures is intentional.
- Setup preserves unmanaged Markdown and existing editor preferences instead of replacing whole files by default.
- `--overwrite` still opts into full replacement, but now also keeps a unique backup.
- Package CJS/ESM entrypoints now resolve to the built artifacts.

MIT. See package metadata for project ownership.
