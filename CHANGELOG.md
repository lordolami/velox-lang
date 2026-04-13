# Changelog

## 0.19.0 (Unreleased)

### Added

- Strict object-shape validation for state expressions:
  - Unknown object properties now fail with `[VX3005]`.
  - Dynamic object indexing on known-shape objects now fails with `[VX3005]`.
- LSP feature expansion:
  - Semantic tokens.
  - Workspace symbols.
  - Code actions for `.js` import fixups, missing render insertion, and duplicate-name rename suggestions.
- LSP quality tooling:
  - End-to-end smoke test (`npm run lsp:smoke`).
  - Performance gate (`npm run lsp:perf`).
- Runtime perf regression gating:
  - `benchmarks/fast-baseline.json`.
  - `npm run bench:fast:gate`.
- Broader app-level benchmark set now includes `examples/pages` as `core-pages`.
- Cloud deploy bundle targets:
  - `velox deploy --target vercel`
  - `velox deploy --target netlify`
  - `velox deploy --target cloudflare-pages`
  - provider-ready output files plus generated `DEPLOY.md`
- Startup readiness gate:
  - `npm run startup:ready`
  - emits report under `spec/reports/startup-readiness-*.json`
- Startup operator docs pack under `spec/startup/`.
- `.env.example` for baseline environment/secrets setup.
- Cloud deploy test suite (`tests/deploy-cloud.test.ts`).

### Changed

- CI now runs `lsp:gate`, `bench:fast:gate`, and `bench:apps:gate`.
- App benchmark regression thresholds were updated for the expanded app suite.

### Notes

- Version remains `0.18.0` in `package.json` until release cut.
