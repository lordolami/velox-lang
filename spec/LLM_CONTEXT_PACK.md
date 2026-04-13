# Velox LLM Context Pack

Use this file as the minimum context for any AI model generating Velox code.

## 1) What Velox Is

- Velox is a frontend language with `.vx` files.
- Compiler is TypeScript.
- Output is JavaScript with optional Wasm acceleration via `@fast`.

## 2) Core Syntax

### Components

```vx
component Counter(label) {
  ~count = 0
  render {
    <h1>{label}</h1>
    <p>{count}</p>
  }
}
```

### Reactive State

```vx
~count = 0
~items = [1, 2, 3]
~profile = { name: "Ada", age: 10 }
~age = profile.age
~first = items[0]
```

### Template Blocks

```vx
{#if count > 0}<small>active</small>{:else}<small>idle</small>{/if}
{#each items as item}<li>{item}</li>{/each}
{#each items as item, i}<li>{i}:{item}</li>{/each}
```

### Events

```vx
<button on:click={handleClick}>Tap</button>
<input on:input={handleInput} />
```

### Imports

```vx
import { add } from "./math.vx"
import { add } from "./math"
import { Chart } from "chart.js/auto"
import "./styles.css"
```

Rule: do not use relative `.js` imports from `.vx`.

### Fast Functions (`@fast`)

```vx
@fast add(a: i32, b: i32) -> i32 {
  return a + b
}
```

Supported for v1/v2: `i32` params/return, arithmetic/comparison/logical ops, `let`, `if/else`, `while`, `return`.

## 3) Framework Conventions

- Routes live in `pages/`.
- `pages/index.vx` => `/`
- `pages/about.vx` => `/about`
- `pages/blog/[slug].vx` => `/blog/:slug`
- `pages/(group)/pricing.vx` => `/pricing`
- `pages/404.vx` => not found
- `pages/_layout.vx` => global layout
- `pages/foo.data.js` => route data module for `foo.vx`
- Optional boundaries:
  - `foo.loading.vx`
  - `foo.error.vx`

## 4) Common Gotchas

1. Component must have exactly one `render` block.
2. Unknown render bindings fail compilation.
3. Empty import clauses are invalid.
4. Duplicate names (component/state/import/param) trigger diagnostics.
5. Relative import must stay inside project root.

## 5) Authoritative Docs

1. `spec/MASTER_SPEC.md`
2. `spec/framework-v1.md`
3. `spec/diagnostics.md`
4. `spec/docs-index.json`
5. `spec/AY_COMPLETION_STATUS.md`
6. `spec/startup/README.md`

## 6) What To Build With This

When asked to build Velox frontend:

1. Create `.vx` pages/layouts under `pages/`.
2. Use `.data.js` for external API or SDK logic.
3. Keep markup simple and deterministic.
4. Prefer patterns already used in `examples/showcase/*`.

Official frontend reference app:

- `apps/velox-web/pages`

Critical data modules for accuracy:

- `apps/velox-web/pages/index.data.js`
- `apps/velox-web/pages/benchmarks.data.js`
- `apps/velox-web/pages/docs/index.data.js`
