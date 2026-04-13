# Velox Master Spec

Version: 1.0.0-rc.1
Status: Active
Last Updated: 2026-04-12

## 1) Mission

Velox is a frontend language (`.vx`) built for:
- Simple authoring syntax
- Fast runtime behavior
- Native reactive UI components
- Optional Wasm acceleration through `@fast`

Velox compiles to JavaScript today and can emit embedded WebAssembly for supported `@fast` kernels.

## 2) Design Principles

1. Easier than JSX for common UI tasks.
2. Fast by default, especially on low-end devices.
3. Clear compile-time errors.
4. Small generated runtime surface.
5. AI-readable, deterministic language behavior.

## 3) Current Language Surface (v1 RC)

### 3.1 Components

```vx
component Counter(label, items, onTap) {
  ~count = 0
  render {
    <button on:click={onTap}>{label}: {count}</button>
    {#if count > 0}<small>active</small>{:else}<small>idle</small>{/if}
    <ul>{#each items as item, i}<li>{i}:{item}</li>{/each}</ul>
  }
}
```

Notes:
- Component param types are optional today (`any` default).
- Component body currently supports reactive declarations and one `render` block.

### 3.2 Reactive State

```vx
~count = 0
```

Reactive values are compiled into a Proxy-based state object with batched microtask updates.
State initializers support number/string/boolean literals, array literals, object literals, identifiers, function-call expressions, arithmetic (`+ - * / %`), comparisons (`== != < > <= >=`), logical operators (`&& ||`), and parentheses/unary operators.

### 3.3 Imports

Top-level ES module imports are supported:

```vx
import { sum } from "./math.vx"
import "./polyfills.vx"
```

Compile behavior:
- Imports are emitted before runtime helpers.
- Relative specifiers ending in `.vx` are rewritten to `.js`.
- Extensionless relative specifiers (for example `./math`) resolve to `./math.vx` in project builds and emit as `./math.js`.

### 3.4 Template Features

Supported inside `render { ... }`:
- Text interpolation: `{name}`
- Conditionals: `{#if expr}...{:else}...{/if}`
- Loops: `{#each items as item}...{/each}`
- Indexed loops: `{#each items as item, i}...{/each}`
- Event directives: `on:<event>={handler}` (for example `click`, `input`, `change`, `submit`, `keydown`)

### 3.5 `@fast` Functions

```vx
@fast calc(a: i32, b: i32) -> i32 {
  let c = a + b
  let d = c * 2
  return d - 1
}
```

Supported in v0.18:
- Params: `i32` only
- Return type: `i32` only
- Expressions: literals, identifiers, unary minus, `+ - * / %`, comparisons, logical `&&/||`, parentheses
- Statements: `let`, local assignment (`x = expr`), `return`, `if/else`, `while`, and trailing expression

## 4) Compile Targets and Runtime Contract

## 4.1 JavaScript Output

Component output shape:
- `state`
- `render()`
- `events`
- `mount(target)`
- `subscribe(listener)`
- `set(patch)`

Runtime helpers emitted when needed:
- `__veloxCreateReactiveState(initialState)`
- `__veloxBindEvents(root, eventBindings, params, state)`

## 4.2 WebAssembly Output

For each `@fast` function:
- A minimal Wasm module is generated
- A JS wrapper function calls exported Wasm symbol directly

If unsupported constructs are used, compile fails with descriptive error.

## 5) Compiler Architecture

Current pipeline:
1. Lexer (`src/lexer.ts`)
2. Parser (`src/parser.ts`)
3. AST (`src/ast.ts`)
4. JS + Wasm-capable codegen (`src/codegen.ts`)
5. Compile entry (`src/compiler.ts`)
6. Dev server (`src/dev-server.ts`)
7. CLI (`src/cli.ts`)

## 6) Error Model

Velox favors fail-fast compile behavior:
- Unknown render binding -> compile error
- Unknown render condition identifier -> compile error
- Unknown event handler -> compile error
- Invalid `@fast` syntax/type support -> compile error
- Module diagnostics use stable codes:
- `VX2001`: missing imported `.vx` module
- `VX2002`: import cycle detected
- `VX2003`: unknown named import symbol
- `VX2004`: duplicate top-level binding / export
- `VX2005`: default import from `.vx` module not supported
- `VX2006`: no `.vx` files found in project path
- `VX3001`: imported `@fast` call arity mismatch
- `VX3002`: imported `@fast` obvious literal type mismatch (for example string/boolean to `i32`)
- `VX3003`: imported component call used in state expression
- `VX3004`: unknown identifier/callable in state expression
- `VX3005`: invalid operand type combination in state expression
- `VX3006`: self-referential state initializer
- `VX3007`: forward state reference in initializer
- `VX3008`: duplicate state declaration in component
- `VX3009`: state name collision with param/import local
- `VX3010`: component param collision with imported local
- `VX3011`: duplicate component param name
- `VX3012`: duplicate imported local name
- `VX3013`: duplicate component name in module
- `VX3014`: duplicate @fast function name in module
- `VX3015`: mixed declaration name conflict (component vs @fast)
- `VX3016`: state name collision with containing component name
- `VX3017`: param name collision with containing component name
- `VX3018`: empty import clause
- `VX3019`: declaration collision with namespace import alias
- `VX3020`: non-relative side-effect import
- `VX3021`: .js import specifier used in .vx source
- `VX3022`: absolute-path import specifier
- `VX3023`: relative import escapes project root
- `VX3024`: unsupported relative import extension
- `VX3025`: reserved for future package-import policy diagnostics
- `VX4001`: duplicate render block in component
- `VX4002`: missing render block in component
- `VX4003`: invalid top-level declaration token
- `VX4004`: unexpected token in component body
- `VX4101`-`VX4112`: malformed template block/binding diagnostics (`{#if}`, `{:else}`, `{/if}`, `{#each}`, `{/each}`, bindings)
- `VX4201`-`VX4208`: import declaration syntax diagnostics (shape, aliasing, missing `from`, missing source, namespace syntax, named import token/brace errors)
- `VX4301`-`VX4308`: component/@fast declaration syntax diagnostics
- `VX4310`-`VX4311`: state declaration syntax diagnostics
- `VX4321`-`VX4325`: parameter list syntax diagnostics
- `VX4331`-`VX4334`: expression/block syntax diagnostics

## 7) Feature Matrix

Implemented:
- Top-level import declarations (side-effect, named/default/namespace)
- `.vx` -> `.js` import specifier rewrite in JS output
- Project-level `.vx` import validation (missing module + cycle detection)
- Named import symbol validation across `.vx` modules
- Duplicate export diagnostics inside a module
- Default imports from `.vx` modules rejected for now
- Duplicate top-level binding diagnostics (imports + declarations)
- Parse-once project compilation path (validation and emit share parsed ASTs)
- Cross-module imported call validation (`@fast` arity/type + imported-component call rejection in state expressions)
- Component parsing and emission
- Reactive `~` declarations
- Template interpolation, conditionals, loops, indexed loops
- Event directive extraction and binding
- `@fast` i32 kernels with locals and expression parsing
- CLI `build` and `dev`
- CLI `check` for validation-only passes (no emitted output)
- Directory-mode `velox build` (recursive `.vx` -> mirrored `.js`)
- Dev preview auto-mount for first detected component export
- Dev hot update loop via dynamic module re-import (no full page reload)
- Directory-mode dev input with recursive `.vx` compilation
- Test suite and fixtures
- VS Code language extension scaffold

Not yet implemented:
- SSR/SSG build pipeline and hydration contract
- Expanded `@fast` numeric type support beyond current stable path
- Cloud deploy targets and preview URL control plane
- Enterprise governance/LTS/security tracks

## 8) Grammar Snapshot (Informal)

```text
program        -> declaration*
declaration    -> importDecl | componentDecl | fastFunctionDecl
importDecl     -> "import" ...
componentDecl  -> "component" IDENT paramList? "{" componentBody* "}"
componentBody  -> reactiveDecl | renderDecl
reactiveDecl   -> "~" IDENT "=" expression
renderDecl     -> "render" block
fastFunction   -> "@" "fast" IDENT typedParamList "->" IDENT block
```

Template directives:
- `{identifier}`
- `{#if condition} ... {:else} ... {/if}`
- `{#each source as item[, index]} ... {/each}`
- `on:event={handler}`

## 9) Quality Gates

A change is accepted when:
1. `npm run build` passes
2. `npm test` passes
3. `npm run bench:ai` passes
4. `npm run lsp:gate` passes
5. `npm run bench:fast:gate` and `npm run bench:apps:gate` pass
6. `npm run check:deterministic` and `npm run verify:quickstart` pass
7. Spec update is included when syntax/runtime behavior changes

## 10) Versioning Policy

- `0.x`: rapid iteration, breaking changes allowed with documentation
- `1.0`: stability target after framework essentials and diagnostics mature

## 11) Immediate Roadmap

1. Extend event support (`on:submit`, keyboard events) and docs
2. Expand `@fast` support beyond `i32`
3. Add type checker pass and symbol resolution
4. Add cross-module type/signature checks for imported symbols
5. Start framework layer: routing primitives

## 12) Dev Server Runtime

`velox dev` currently provides:
- Recursive `.vx` discovery when input is a directory
- Incremental rebuild cache keyed by file fingerprint (size + mtime)
- Stale-output cleanup when source files are removed
- Browser live updates via SSE + dynamic module re-import
- First-export auto-mount for fast preview
## 13) Source of Truth

This file is the master spec for current Velox behavior and near-term direction.
When implementation and docs differ, update this file in the same change set.
