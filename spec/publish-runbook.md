# Velox Publish Runbook (v1 Closeout)

Date: 2026-04-13

This runbook assumes artifacts are already built:

- npm tarball: `velox-0.18.0.tgz`
- VS Code extension: `vscode/velox-language/velox-language-0.1.0.vsix`

## 1) npm Publish

From repo root:

```bash
npm adduser
npm publish
```

Verification:

```bash
npm view velox version
```

## 2) VS Code Marketplace Publish

From `vscode/velox-language`:

```bash
npx @vscode/vsce login <publisher-name>
npx @vscode/vsce publish
```

Alternative using PAT env var:

```bash
$env:VSCE_PAT="<your_pat>"
npx @vscode/vsce publish
```

Verification:

1. Open VS Code Marketplace page for `velox-language`.
2. Install from marketplace and open a `.vx` file.

## 3) Optional Git Tag + Release (if repo remote is configured)

```bash
git tag v1.0.0
git push origin v1.0.0
```

Attach release notes from:

- `spec/v1-release-notes.md`
- `CHANGELOG.md`

## 4) Final Sanity Checks

```bash
npm run release:v1:check
```

Expected:

- All checks green.
- Report emitted to `spec/reports/`.
