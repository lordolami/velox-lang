# Velox v1 Release Notes (Draft)

Date: 2026-04-13  
Status: Release Candidate Draft

## Highlights

1. Full `.vx` compiler pipeline in TypeScript.
2. Built-in component model with reactive `~state`.
3. Router-capable project builds with pages conventions.
4. `@fast` Wasm lane for CPU-heavy `i32` kernels.
5. Strong diagnostics catalog (`VX2xxx`, `VX3xxx`, `VX4xxx`).
6. VS Code extension with syntax + LSP intelligence.
7. Deterministic-gated quality checks and benchmarks.

## Core Capabilities

1. Language frontend:
   - Lexer and parser for components/imports/render directives/`@fast`.
   - AST + semantic checks with stable diagnostic codes.

2. Compiler backend:
   - JS generation for components/runtime.
   - Wasm module generation for `@fast`.
   - Project compilation with route/data/asset manifests.

3. Framework/runtime:
   - Reactive microtask batching.
   - Event directive binding (`on:*`).
   - File-based route build artifacts and runtime router output.

4. CLI:
   - `velox init`
   - `velox check`
   - `velox build`
   - `velox dev`
   - `velox preview`
   - `velox deploy`
   - `velox deployments`

## Tooling and Validation

1. Test suite for compiler/runtime/deploy/preview/scaffold.
2. AI reliability benchmark suite.
3. Fast-kernel regression gates.
4. App-level performance regression gates.
5. LSP smoke/performance gates.
6. Deterministic output check for showcase app builds.
7. Quickstart flow timing check (`init -> dev -> build -> preview -> deploy`).

## Known Constraints in v1

1. `@fast` types are currently centered on `i32`.
2. npm publish and VS Code Marketplace publish are manual release steps.
3. External adoption KPIs depend on post-release usage data.

## Release Commands

```bash
npm run release:v1:check
```

Manual publish checklist:

1. `npm publish`
2. package VS Code extension and publish to Marketplace
3. tag release and publish changelog/release notes
