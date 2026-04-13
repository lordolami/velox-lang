# Velox Handoff For Claude (No Repo Access Required)

## Project

Velox is a frontend language and framework:
- Source language: `.vx`
- Compiler/runtime: TypeScript
- Targets: JavaScript + `@fast` Wasm lane

Goal for this task:
- Build the **official Velox frontend website** using Velox itself (`.vx` pages/layout/data), not JSX/React.

## Current Status (already done)

1. Core compiler/framework baseline is stable.
2. Tests + quality gates are green.
3. Cloud deploy bundle targets exist:
   - `local`
   - `vercel`
   - `netlify`
   - `cloudflare-pages`
4. A-Y startup readiness pack is complete.

## Key Conventions

1. File-based routing under `pages/`
2. Layout files:
   - global: `pages/_layout.vx`
   - segment: `pages/<segment>/_layout.vx`
3. Route data files:
   - `pages/foo.data.js` paired with `pages/foo.vx`
4. Optional loading/error boundaries:
   - `pages/foo.loading.vx`
   - `pages/foo.error.vx`
5. `.vx` imports:
   - Use `.vx` or extensionless for local modules
   - Do **not** use relative `.js` imports from `.vx`

## Build Target To Implement

Create official Velox web app (suggested path: `apps/velox-web/pages`) with:

1. Landing page
2. Docs index page
3. Quickstart page
4. Why Velox page
5. Benchmarks page
6. AI Build page
7. Showcase page
8. 404 page
9. Shared global layout/nav/footer

## UX Requirements

1. Responsive on mobile + desktop
2. Fast initial load
3. Clean, intentional design
4. Clear docs navigation
5. Benchmark cards sourced from existing reports in `spec/reports/`

## Existing Source-of-Truth Docs

0. `spec/LLM_CONTEXT_PACK.md` (read this first for syntax + conventions)
1. `spec/MASTER_SPEC.md`
2. `spec/framework-v1.md`
3. `spec/docs-index.json`
4. `spec/AY_COMPLETION_STATUS.md`
5. `spec/startup/README.md`
6. `README.md`

## Safety / Quality Requirements

Do not break existing behavior. Keep these green:

1. Build
2. Tests
3. LSP gate
4. Fast perf gate
5. App perf gate
6. Deterministic output
7. Quickstart verification
8. Startup readiness gate

## Output Format Requested From Claude

1. What was built
2. Files changed
3. Validation status
4. Known limitations
5. Next sprint suggestions

## Single Prompt To Give Claude

You are implementing the official Velox frontend website in this codebase. Use only Velox conventions (`.vx` pages/layout/data), keep existing compiler/framework behavior intact, and deliver a fully navigable docs/marketing frontend under `apps/velox-web/pages` with landing/docs/quickstart/why/benchmarks/ai/showcase/404 plus shared layout and navigation. Reuse source-of-truth docs from `spec/*`, render benchmark information from existing report artifacts, and ensure all existing quality gates remain green. Provide a concise final summary with files changed, validation results, and remaining gaps.
