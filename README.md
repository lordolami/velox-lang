# Velox (v1 Closeout RC)

Velox is a frontend language that compiles `.vx` files to JavaScript with a Wasm lane for `@fast` functions.

## Docs Hub

- Core spec: `spec/MASTER_SPEC.md`
- v1 language spec: `spec/v1.md`
- v1 closeout: `spec/v1-closeout.md`
- v1 release notes: `spec/v1-release-notes.md`
- migration to v1: `spec/migration-to-v1.md`
- publish runbook: `spec/publish-runbook.md`
- Framework spec: `spec/framework-v1.md`
- Quickstart: `spec/quickstart.md`
- Recipes: `spec/recipes.md`
- Troubleshooting: `spec/troubleshooting.md`
- AI index: `spec/docs-index.json`
- AI bootstrap A-Z: `spec/AI_BOOTSTRAP_A_TO_Z.md`
- A-Y completion board: `spec/AY_COMPLETION_STATUS.md`
- Startup pack: `spec/startup/README.md`
- Post-launch roadmap: `spec/post-launch-roadmap.md`
- v2 readiness: `spec/v2-readiness.md`
- v1 -> v2 migration: `spec/migration-v1-to-v2.md`
- Machine roadmap: `spec/roadmap.json`
- v1-v6 master roadmap: `spec/v1-v6-master-roadmap.md`
- v1-v6 execution board: `spec/v1-v6-execution-board.md`
- v1-v6 machine roadmap: `spec/v1-v6-roadmap.json`
- Changelog: `CHANGELOG.md`

## Commands

```bash
npm install
npm run build
npm test
npm run bench:apps
npm run bench:fast:gate
npm run bench:apps:report
npm run lsp:gate
npm run check:deterministic
npm run verify:quickstart
npm run startup:ready
npm run release:v1:check
npm run check:mega60
npm run build:mega60
node dist/cli.js init my-app --template pages
node dist/cli.js build examples/counter.vx -o dist-example/counter.js
node dist/cli.js build examples -o dist-example
node dist/cli.js build examples/pages -o dist-pages
node dist/cli.js check examples
node dist/cli.js dev examples/counter.vx --port 3000 --open
node dist/cli.js dev examples --port 3000
node dist/cli.js dev examples/pages --port 3000
node dist/cli.js deploy examples/pages --target local --name velox-demo
node dist/cli.js deploy examples/pages --target vercel --name velox-demo
node dist/cli.js deploy examples/pages --target netlify --name velox-demo
node dist/cli.js deploy examples/pages --target cloudflare-pages --name velox-demo
node dist/cli.js deployments examples/pages --json
node dist/cli.js preview dist-pages --port 4173 --open
```

## Post-Launch Focus

Execution now tracks three active workstreams:

- Docs polish (developer + AI readability): complete docs hub and canonical framework references in `spec/`.
- Post-launch roadmap (adoption + reliability + scale): phased plan in `spec/post-launch-roadmap.md` with KPI targets in `spec/roadmap.json`.
- Full version modeling (v1-v6): long-range milestones in `spec/v1-v6-master-roadmap.md` and execution board in `spec/v1-v6-execution-board.md`.

## Showcase Apps (All `.vx`)

Three production-style demo apps live in `examples/showcase`:

- `examples/showcase/todo/pages`
- `examples/showcase/dashboard/pages`
- `examples/showcase/landing/pages`

Build one app:

```bash
node dist/cli.js build examples/showcase/todo/pages -o dist-showcase-todo
node dist/cli.js preview dist-showcase-todo --port 4173
```

## Quality Gates

Velox now ships with CI in `.github/workflows/ci.yml`.

Every push/PR runs:

```bash
npm run build
npm test
npm run bench:ai
npm run lsp:gate
npm run bench:fast:gate
npm run bench:apps
npm run bench:apps:gate
npm run check:deterministic
npm run verify:quickstart
```

## Config File (`velox.config.json`)

Velox CLI auto-loads `velox.config.json` from the input directory (or nearest parent):

```json
{
  "build": {
    "outDir": "dist",
    "copyPublic": true,
    "router": { "enabled": true, "title": "Velox App" }
  },
  "dev": {
    "outDir": "dist-dev",
    "port": 3000,
    "open": false,
    "copyPublic": true,
    "router": { "enabled": true, "title": "Velox Dev" }
  },
  "deploy": {
    "target": "local",
    "appName": "velox-app",
    "buildOutDir": "dist",
    "outputDir": ".velox/deployments"
  }
}
```

- CLI flags still win over config values.
- `build.router.enabled=false` skips router artifact generation.
- `build.copyPublic=false` skips copying `public/` into output.
- `velox init` scaffolds starter projects: `--template pages` (router-first) or `--template single` (minimal app).
- `velox deploy` runs build then publishes to a local deployment target (`.velox/deployments/...`).
- `velox deploy --target vercel|netlify|cloudflare-pages` emits cloud-ready deploy bundles plus `DEPLOY.md`.
- `velox deployments` lists local deployment history (table or `--json` output).
- `velox preview` serves built output locally (SPA fallback on by default; use `--no-spa` to disable).

## Current Syntax (v0.18)

```vx
import { sum } from "./math.vx"

component Counter(label, items, onTap) {
  ~count = 0
  render {
    <button on:click={onTap}>{label}: {count}</button>
    {#if count}<small>active</small>{:else}<small>idle</small>{/if}
    <ul>{#each items as item, i}<li>{i}:{item}</li>{/each}</ul>
  }
}

@fast sum(a: i32, b: i32) -> i32 {
  a + b
}

@fast add1(a: i32) -> i32 {
  a + 1
}

@fast calc(a: i32, b: i32) -> i32 {
  let c = a + b
  let d = c * 2
  return d - 1
}

@fast mod(a: i32, b: i32) -> i32 {
  a % b
}

@fast gt(a: i32) -> i32 {
  a > 0
}

@fast abs(a: i32) -> i32 {
  if a >= 0 {
    return a
  } else {
    return -a
  }
}

@fast bothPositive(a: i32, b: i32) -> i32 {
  a > 0 && b > 0
}

@fast branchLocal(a: i32) -> i32 {
  if a > 0 {
    let x = a * 2
    return x
  } else {
    let y = -a
    return y
  }
}
```

## Notes

- Component param types are optional (easy-mode syntax).
- Top-level imports supported: `import { x } from "./file.vx"` or `import { x } from "./file"` (rewritten to `.js` in output).
- Event directives supported: `on:<event>={handler}` (e.g., `click`, `input`, `change`).
- Template conditionals supported: `{#if cond}...{:else}...{/if}`.
- Template loops supported: `{#each items as item}...{/each}`.
- Indexed loops supported: `{#each items as item, i}...{/each}`.
- Call expressions supported in state initializers: `~total = sum(1, 2)`.
- Boolean literals supported in state initializers: `~ready = true` / `~ready = false`.
- Object literals supported in state initializers: `~profile = { name: "Ada", age: 10 }`.
- Member/index expressions supported in state initializers: `~age = profile.age`, `~first = items[0]`.
- Arithmetic expressions supported in state initializers: `~score = ((a + 1) * b - 2) % 3`.
- Comparison/logical expressions supported in state initializers: `~ok = (a + 1) > b && ready`.
- `~` state compiles to batched reactive updates (microtask scheduler).
- `@fast` compiles to embedded WebAssembly for `i32` math kernels.
- `@fast` supports literals, parentheses, multi-line `let`, `return`, `%`, comparisons, logical `&&/||`, if/else branches, and branch-local `let`.
- Unknown render bindings now fail at compile-time with a clear error.
- `velox dev` is available with file watch rebuilds and browser auto-reload.
- Dev preview now auto-mounts the first component export with inferred placeholder props.
- Dev update loop now hot-imports rebuilt modules without full page refresh.
- `velox dev` supports directory input and compiles all `.vx` files recursively.
- `velox dev` now uses incremental compile caching (unchanged files are skipped).
- `velox build` now supports directory input and mirrors `.vx` tree structure into `.js` output.
- `velox check` validates `.vx` files/projects without writing output files.
- Directory project builds validate `.vx` imports and fail fast on missing files or cycles.
- Directory project builds validate imported symbol names and duplicate module exports.
- Directory project builds reject duplicate top-level names (import aliases + declarations).
- Default imports from `.vx` modules are currently rejected (named/namespace imports only).
- Directory build path now parses each source file once (shared for validation + emit).
- Module build diagnostics now include stable codes (for example `[VX2001]` missing module, `[VX2002]` cycle).
- Cross-module imported call checks now validate `@fast` arity/type (`[VX3001]`, `[VX3002]`) and reject calling imported components in state expressions (`[VX3003]`).
- State inference now tracks `object` and `array` state shapes so invalid numeric/logical ops fail earlier (`[VX3005]`).
- State expressions now fail fast on unknown identifiers/callables (`[VX3004]`).
- State expressions now fail fast on invalid operator/type combinations (`[VX3005]`).
- Self-referential state initializers now fail fast (`[VX3006]`), while later state declarations can reference earlier ones.
- Forward state references now fail fast (`[VX3007]`) so initializer order is deterministic.
- Duplicate state declarations in a component now fail fast (`[VX3008]`).
- State names that collide with params/imported locals now fail fast (`[VX3009]`).
- Component param names that collide with imported locals now fail fast (`[VX3010]`).
- Duplicate component param names now fail fast (`[VX3011]`).
- Duplicate imported local names now fail fast with a dedicated diagnostic (`[VX3012]`).
- Duplicate component names in one module now fail fast with a dedicated diagnostic (`[VX3013]`).
- Duplicate `@fast` function names in one module now fail fast with a dedicated diagnostic (`[VX3014]`).
- Mixed declaration name conflicts (`component X` + `@fast X`) now fail with a dedicated diagnostic (`[VX3015]`).
- State names matching their component name now fail fast (`[VX3016]`).
- Param names matching their component name now fail fast (`[VX3017]`).
- Empty import clauses now fail fast (`[VX3018]`), for example `import {} from "./x"`.
- Namespace import alias collisions with declarations now fail fast (`[VX3019]`).
- Non-relative side-effect imports are supported for packages (for example `import "polyfills"`).
- `.js` import specifiers inside `.vx` source now fail fast (`[VX3021]`); use `.vx` or extensionless imports.
- Absolute-path import specifiers now fail fast (`[VX3022]`); use relative or package specifiers.
- Relative imports that escape project root now fail fast (`[VX3023]`).
- Unsupported relative import extensions now fail fast (`[VX3024]`).
- Side-effect relative CSS imports are supported (`import "./styles.css"`), and CSS files are copied into build output.
- Non-relative value imports are supported for packages (symbol validation applies only to project-relative imports).
- Orphan route convention files now fail fast: `*.loading.vx` (`[VX3026]`), `*.error.vx` (`[VX3027]`), `*.data.js` (`[VX3028]`) must each match an existing page.
- `examples/mega60` now ships a 60-file `.vx` corpus for batch validation and perf smoke tests.
- File-based router is now available for `pages/` apps. Velox emits `index.html` + `__velox_router.js` during build.
- Route conventions: `index.vx -> /`, `about.vx -> /about`, `blog/[slug].vx -> /blog/:slug`, `docs/[...rest].vx -> /docs/*rest`.
- Route groups are supported: `pages/(marketing)/pricing.vx -> /pricing`.
- Not-found route is supported with `pages/404.vx` (wired as router fallback).
- Link prefetch is built into router runtime on hover/focus for internal routes.
- Nested layouts are supported with `pages/_layout.vx` and segment layouts like `pages/blog/_layout.vx`.
- Router injects route context args by name: `params`, `query`, `pathname`, `path`, `search`, `hash`, `url`.
- Layout components can consume `content` (or `children` / `child` / `slot`) to wrap page HTML.
- Build now copies static assets from `public/` into output root automatically.
- Route data loading convention is supported via sibling `*.data.js` modules (for example `pages/blog/[slug].data.js`).
- `*.data.js` can export `load(ctx)` (or default function) and router injects the result as `data` param.
- `load(ctx)` can also return control signals: `{ redirect: "/login" }`, `{ notFound: true }`, or `{ error: "message" }`.
- Route loading and error conventions are supported with sibling `*.loading.vx` and `*.error.vx` files.
- Example: `pages/about.loading.vx` renders while page/data resolves; `pages/about.error.vx` renders on route load failure.
- Render/template text supports `$` characters directly (for example pricing copy like `$29`).
- Project builds now emit `velox-manifest.json` (routes, output modules, copied assets) for deployment automation.
- Parser now enforces one `render` block per component (`[VX4001]`) and requires `render` to exist (`[VX4002]`).
- Parser now emits stable declaration/body diagnostics (`[VX4003]`, `[VX4004]`) for invalid top-level/component tokens.
- Template block parser now emits structured `VX410x` diagnostics for malformed `{#if}` / `{#each}` usage.
- Import parser now emits structured diagnostics (`[VX4201]`, `[VX4202]`) for malformed import declarations/aliases.
- Import parser now emits richer subcodes (`[VX4201]`-`[VX4208]`) for malformed declaration shape, `from`/source issues, namespace syntax, and named-import tokens.
- Core parser now emits structured diagnostics for component/state/param/expression syntax (`VX430x`, `VX431x`, `VX432x`, `VX433x`).

## VS Code Syntax Highlighting

- Workspace settings now map `.vx` to `velox` language mode.
- Native Velox extension lives at `vscode/velox-language`.
- To run it locally:
  1. Open `vscode/velox-language` in VS Code.
  2. Press `F5` to launch an Extension Development Host.
  3. Open `.vx` files in that host window.
