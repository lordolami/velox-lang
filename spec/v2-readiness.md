# Velox v2 Readiness

Date: 2026-04-12

This document tracks the v2 hardening goals and current status.

## Scope

1. Type checker hardening.
2. Stronger editor intelligence (LSP).
3. LSP quality gates (correctness + latency).
4. Performance regression gates (kernel + app-level).
5. Release readiness docs/migration trail.

## Status

1. Type checker hardening: Complete.
   - Strict object property/index rules in state expressions.
   - Tests added for `[VX3005]` object-shape violations.

2. Editor intelligence: Complete.
   - Semantic tokens.
   - Workspace symbols.
   - Alias-aware import definition/reference/rename behavior.
   - Quick-fix code actions for common diagnostics.

3. LSP quality gates: Complete.
   - `npm run lsp:smoke`
   - `npm run lsp:perf`
   - CI includes `npm run lsp:gate`.

4. Perf regression gates: Complete.
   - Kernel gate: `npm run bench:fast:gate`.
   - App gate: `npm run bench:apps:gate`.
   - App suite expanded to include `core-pages`.

5. Release docs: Complete.
   - `CHANGELOG.md`
   - `spec/migration-v1-to-v2.md`
   - This readiness document.

## Exit Criteria

v2 is considered ready when all commands pass on CI:

```bash
npm run build
npm test
npm run bench:ai
npm run lsp:gate
npm run bench:fast:gate
npm run bench:apps:gate
```
