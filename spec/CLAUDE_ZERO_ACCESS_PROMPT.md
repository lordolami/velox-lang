# Claude Zero-Access Prompt (Paste As-Is)

You have **no filesystem access**. Treat this prompt as the full source of truth.

You are helping build the official frontend for **Velox** (a custom frontend language).
Your output must be Velox-native architecture and code plans (and code snippets) that can be applied directly.

---

## 1) What Velox Is

- Velox source files use `.vx`.
- Velox compiles to JavaScript.
- Velox supports `@fast` functions for WebAssembly-oriented compute kernels.
- Velox framework uses file-based routing with a `pages/` convention.

---

## 2) Velox Syntax (Canonical)

### Component

```vx
component Home(title) {
  ~count = 0
  render {
    <main>
      <h1>{title}</h1>
      <p>{count}</p>
    </main>
  }
}
```

### Reactive state

```vx
~count = 0
~items = [1, 2, 3]
~profile = { name: "Ada", age: 10 }
~age = profile.age
~first = items[0]
```

### Conditionals/loops

```vx
{#if count > 0}<small>active</small>{:else}<small>idle</small>{/if}
{#each items as item}<li>{item}</li>{/each}
{#each items as item, i}<li>{i}:{item}</li>{/each}
```

### Events

```vx
<button on:click={onTap}>Tap</button>
<input on:input={onInput} />
```

### Imports

```vx
import { add } from "./math.vx"
import { add } from "./math"
import { Chart } from "chart.js/auto"
import "./styles.css"
```

Import rules:
1. Relative `.js` imports from `.vx` are invalid.
2. Use `.vx` or extensionless for local relative imports.
3. Package imports are allowed.

### `@fast`

```vx
@fast add(a: i32, b: i32) -> i32 {
  return a + b
}
```

`@fast` supports: `i32`, arithmetic, comparisons, logical ops, `let`, assignment, `if/else`, `while`, `return`.

---

## 3) Velox Framework Conventions

Routing under `pages/`:
1. `pages/index.vx` -> `/`
2. `pages/about.vx` -> `/about`
3. `pages/blog/[slug].vx` -> `/blog/:slug`
4. `pages/(marketing)/pricing.vx` -> `/pricing`
5. `pages/404.vx` -> not found

Layouts:
1. Global layout: `pages/_layout.vx`
2. Segment layout: `pages/segment/_layout.vx`

Route data:
1. `pages/foo.data.js` pairs with `pages/foo.vx`
2. `load(ctx)` return is passed into page as `data`
3. Control signals: `{ redirect: "/login" }`, `{ notFound: true }`, `{ error: "message" }`

Optional boundaries:
1. `foo.loading.vx`
2. `foo.error.vx`

---

## 4) Known Validation Rules

1. Component must have exactly one `render` block.
2. Unknown render binding fails compile.
3. Duplicate names (state/param/import/component) fail compile.
4. Relative imports cannot escape project root.
5. Empty import clause is invalid.

---

## 5) Current Platform State

Already built and stable:
1. Compiler + parser + codegen + CLI.
2. LSP baseline.
3. Performance gates and AI reliability checks.
4. Deploy bundles for targets:
   - local
   - vercel
   - netlify
   - cloudflare-pages

Current quality baseline:
1. Tests passing: 186
2. Startup readiness gate is green.

---

## 6) Your Mission

Design and produce the **official Velox frontend website**, built conceptually in Velox conventions.

Required pages:
1. Landing
2. Docs index
3. Quickstart
4. Why Velox
5. Benchmarks
6. AI Build
7. Showcase
8. 404

Required shared structure:
1. Global layout with nav/footer.
2. Docs sections and deep-link cards.
3. Benchmark cards and methodology block.
4. “Build with AI” workflow page.

---

## 7) Output Requirements

Return:
1. Proposed file tree for `apps/velox-web/pages`.
2. Complete `.vx` content for each page/layout.
3. Any required `.data.js` files.
4. Design tokens / CSS strategy (minimal and fast).
5. Notes for deploy compatibility across Vercel/Netlify/Cloudflare Pages.
6. A “known limitations” section.

Do not use JSX/React idioms as primary output.
Do not assume unavailable framework APIs not described here.

---

## 8) Style Constraints

1. Keep syntax simple and explicit.
2. Keep output deterministic and production-minded.
3. Avoid unnecessary complexity.
4. Optimize for clarity and fast onboarding.

