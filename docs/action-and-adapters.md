# Action and instruction adapters: development preview

The composite Action is code in this repository, not a Marketplace listing or a published release. It uses the built CLI at the action checkout. It installs its own locked production dependencies with lifecycle scripts disabled. It does not upload artifacts, write PR comments, grant token permissions or install project dependencies. The calling workflow owns Node setup, dependencies and its security policy.

Use only a reviewed immutable commit SHA. Example workflow shape (replace REVIEWED_SHA with a real reviewed commit):

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
  - run: npm ci
  - uses: Thinker-Toolkit/Thinker-toolkit-@REVIEWED_SHA
    with:
      trust-project-commands: 'true'
```

Never run untrusted PR code using pull_request_target, privileged tokens, secrets or a persistent self-hosted runner. Ordinary fork PR checks should use isolated hosted runners with minimal permissions. Config commands execute repository code even though Thinker uses argv without a shell. Artifacts may contain secrets; no automatic upload is included. Add a reviewed upload step only if your policy allows it.

## New file targets

- `thinker integrate --target agents` writes a managed block to AGENTS.md.
- `thinker integrate --target copilot` writes a managed block to .github/copilot-instructions.md.

Both preserve other content, keep unique backups on change and skip unchanged runs. No account setting or editor extension is changed. These tests validate generated files, not end-to-end behavior of every agent or Copilot feature. Consult current editor docs and confirm the assistant actually loads the file.

Format sources checked 24 November 2026:
- https://agents.md/
- https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot

Existing rule-file targets remain for compatibility. A full Agent Skills directory export and editor-version test matrix are not implemented in this slice.
