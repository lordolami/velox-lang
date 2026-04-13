# Migration to Velox v1

Date: 2026-04-13

This document is for teams moving from pre-v1 iterations to the v1-stable surface.

## Required Updates

1. Relative imports in `.vx` source:
   - Use `.vx` or extensionless source imports.
   - Do not use `.js` specifiers in source files (`[VX3021]`).

2. Component shape:
   - Exactly one `render` block per component.
   - Missing render is now a hard error (`[VX4002]`).

3. State expression validation:
   - Unknown identifiers and invalid operator/type combinations fail fast (`[VX3004]`, `[VX3005]`).
   - Known-shape object property/index misuse now fails with `[VX3005]`.

4. Import hygiene:
   - Empty import clauses are rejected (`[VX3018]`).
   - Duplicate import locals / top-level name collisions are rejected (`[VX3012]`, `[VX2004]`).

## Recommended Upgrade Commands

```bash
npm run build
npm test
node dist/cli.js check <project-dir>
npm run lsp:gate
npm run bench:fast:gate
npm run bench:apps:gate
```

## Optional Readiness Verification

```bash
npm run release:v1:check
```

## Common Fixes

1. Replace source import:
   - Before: `import { x } from "./mod.js"`
   - After: `import { x } from "./mod.vx"` or `import { x } from "./mod"`

2. Missing render block:
   - Add `render { ... }` inside component.

3. Invalid dynamic object indexing:
   - Before: `~v = profile[key]`
   - After: `~v = profile["name"]` when object shape is known.
