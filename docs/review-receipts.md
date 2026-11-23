# Review receipts: development preview

Not yet released on npm. The published version remains 0.2.1. Build this checkout with `npm ci` before trying the new commands.

## Review the plan before execution

Create thinker.config.json in a Git checkout:

```json
{
  "version": 1,
  "checks": [
    { "name": "types", "command": ["npm", "run", "typecheck"], "required": true },
    { "name": "tests", "command": ["npm", "test"], "timeoutMs": 120000 },
    { "name": "build", "command": ["npm", "run", "build"], "required": true }
  ]
}
```

`node /path/to/thinker/bin/thinker.js doctor` validates config and finds executables. It does not execute project checks. File presence does not prove assistant compliance.

`thinker check --plan` prints argv arrays without running them. `thinker check --trust` explicitly allows those commands to execute local repository code. Never grant trust to an unfamiliar checkout without review. No shell is used. Scripts invoked by commands can still run arbitrary code, use the network, or access credentials.

Optional cwd is relative to the current project; symlinks and paths outside it are refused. Required defaults true; optional failures are recorded without failing the run. Timeouts default to two minutes, maximum ten minutes. Windows npm/npx commands need an npm-launched environment (npm_execpath), or explicit node + npm CLI paths. Other executable argv arrays run directly.

## What the receipt proves

Each run writes a uniquely named JSON record and Markdown summary under `.thinker/receipts/`. Add `.thinker/` to your own .gitignore. Files use owner-only permissions where supported. Nothing is uploaded by the CLI or included in Git automatically. Inspect before sharing or uploading any artifact.

Records include head SHA, first parent SHA (not an inferred PR merge base), dirty state, before/after working-tree fingerprints, command argv/cwd, required/optional status, exit code, duration and bounded output. Any edit during the run fails its overall result. `thinker receipt` fails if the latest receipt failed or its tree/head is now stale. A local receipt is editable and is not attestation or a security boundary.

Fingerprint scope is tracked and non-ignored untracked regular files from Git. Ignored files, dependencies, external services and environment changes are outside that scope. Receipt output itself is excluded. Limits: 20,000 files, 10 MiB per file. Secret redaction is best effort using secret-like environment names and common token patterns; do not assume it catches every secret. Full captured output is capped at 128 KiB per check. Do not pass secrets in argv.

## Reproducible demo

`npm run demo` creates a disposable fixture. It demonstrates a real failing regression (false becomes true), refusal without trust, the fix, a passing receipt, and stale detection after another edit. No project files are changed and no model is involved.

## Team validation still needed

No claim of five independent pilot repositories, retained adoption or editor-version compatibility is made. Test these on real projects before broad release. Hosted history, telemetry, auto-merge, marketplace submission and release publishing are not included.
