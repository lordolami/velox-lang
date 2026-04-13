# AI Build Contract (Velox)

## Goal

Ensure any AI agent can generate valid, deployable Velox projects with deterministic outputs.

## Required Inputs

1. `spec/MASTER_SPEC.md`
2. `spec/framework-v1.md`
3. `spec/diagnostics.md`
4. `spec/docs-index.json`
5. `spec/recipes.md`

## Required Output Shape

1. `.vx` pages/components in `pages/`
2. Optional sibling route data modules as `*.data.js`
3. Optional `public/` static assets
4. Optional `velox.config.json`

## Agent Rules

1. Never emit relative `.js` imports from `.vx`; use `.vx` or extensionless.
2. Use `@fast` only for supported `i32` kernels.
3. For router apps, include `pages/index.vx` and optionally `pages/_layout.vx`.
4. Keep third-party SDK logic in `.data.js` or JS modules.

## Validation Contract

Run all before declaring success:

```bash
npm run build
npm test
npm run bench:ai
npm run lsp:gate
npm run bench:fast:gate
npm run bench:apps:gate
npm run check:deterministic
npm run verify:quickstart
```

