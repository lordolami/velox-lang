# Velox VS Code Extension

This extension adds language support for `.vx` and `.VX` files:
- Syntax highlighting
- LSP-powered autocomplete (project symbols + snippets)
- LSP hover, go-to-definition, references, rename, signature help
- Semantic tokens and workspace symbol search
- Quick fixes for common diagnostics (`.js` import fixup, missing render scaffold, duplicate-name suggestions)
- Document symbols (components, params, state, `@fast`)
- Alias-aware import rename/definition behavior across files
- Server-side structural diagnostics (duplicates, missing render, import resolution)
- On-save/on-open diagnostics via `velox check`
- Explorer file decoration badge (`VX`) on Velox files

## Run Locally

1. Open `vscode/velox-language` in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. Open any `.vx` file in the new window.
4. Run `Velox: Check Current File` from the Command Palette to force diagnostics.

## LSP Architecture

- `extension.js`: Language client bootstrap + CLI diagnostics integration.
- `lsp/server.js`: Language server process implementing symbol intelligence.

Install extension dependencies before running:

```bash
cd vscode/velox-language
npm install
npm run bundle
```

Run LSP quality checks from the repo root:

```bash
npm run lsp:smoke
npm run lsp:perf
```

## Package and Install

1. Install `vsce`: `npm i -g @vscode/vsce`
2. From `vscode/velox-language`, run: `npm run bundle`
3. Package: `vsce package`
4. Install the generated `.vsix`:
   - VS Code Command Palette -> `Extensions: Install from VSIX...`

## Settings

- `velox.cliPath`
  - Optional explicit path to Velox CLI executable.
- `velox.diagnostics.enabled`
  - Enable/disable diagnostics from `velox check`.
