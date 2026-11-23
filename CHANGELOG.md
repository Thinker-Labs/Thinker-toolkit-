# Changelog

## 0.2.1

- Document pinned npm installation and link to the published package.
- Remove pre-publication GitHub-only installation wording.
- Make the packed CLI version smoke test follow package metadata.
- No setup or verification behavior changes.

## 0.2.0

### Changed
- Verification returns a failure exit code when required TypeScript or npm test checks fail. Explicit --lenient mode preserves an opt-in zero exit code.
- Check output is visible, timeouts are failures, and Git status is clearly informational.
- Markdown setup updates a managed block and preserves user content outside it.
- Existing strict-JSON VS Code settings retain unrelated user preferences.
- Changed files receive unique numbered backups, including explicit whole-file replacement.
- Repeating unchanged setup does not rewrite files or create extra backups.
- Partial setup reports incomplete status and a nonzero exit code.

### Fixed
- CJS and ESM package entrypoints resolve to built artifacts.
- Detector tests use temporary fixtures rather than requiring a sibling project.
- Symlink target paths and malformed managed markers are refused.
- JSONC settings are refused unchanged instead of being overwritten implicitly.

### Validation
- 21 automated tests, TypeScript checks, build and packed-consumer smoke checks.
- CI on Linux, macOS and Windows with Node.js 20 and 22.
- Development test-tool dependencies updated; audit reported zero vulnerabilities at validation time.

### Compatibility
- Requires Node.js 18+ for the CLI; development/tests require Node.js 20+.
- Existing unmarked rule content is preserved; older duplicate Thinker instructions may need manual review.
- Editor instructions guide behavior, not enforce it. Verification still uses TypeScript/npm commands and does not run lint/build automatically.
