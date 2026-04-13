# Velox Migration Guide: v1 -> v2

This guide covers compatibility and adoption changes when moving from the v1 toolchain baseline to the current v2-ready slice.

## Breaking/Strictness Changes

1. Object property access is stricter in state expressions.
   - Accessing unknown properties on known-shape objects now fails with `[VX3005]`.
   - Dynamic indexing (`obj[key]`) on known-shape objects now requires unknown object shape; known-shape object index must use string literal key.

2. `.js` relative imports in `.vx` source are rejected.
   - Use `.vx` or extensionless local imports in source.
   - Compiler/LSP diagnostic: `[VX3021]`.

## Tooling Upgrades (No Code Changes Required)

1. LSP now includes semantic tokens, workspace symbols, and quick-fix code actions.
2. New quality commands:
   - `npm run lsp:gate`
   - `npm run bench:fast:gate`
   - `npm run bench:apps:gate`

## Recommended Upgrade Flow

1. Run `npm run build && npm test`.
2. Run `node dist/cli.js check <your-project-root>`.
3. Run `npm run lsp:gate`.
4. Run `npm run bench:fast:gate && npm run bench:apps:gate`.
5. Fix any `[VX3005]` and `[VX3021]` diagnostics.

## Common Fixes

1. Unknown object property
   - Before: `~x = profile.unknownKey`
   - After: add property in initializer or use valid key.

2. Dynamic object index on known shape
   - Before: `~x = profile[key]`
   - After: use literal key (`profile["name"]`) or change shape strategy.

3. `.js` import in source
   - Before: `import { sum } from "./math.js"`
   - After: `import { sum } from "./math.vx"` or `import { sum } from "./math"`
