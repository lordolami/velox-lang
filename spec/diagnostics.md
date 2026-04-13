# Velox Diagnostics Catalog (v1)

Version: 1
Source: `src/parser.ts`, `src/compiler.ts`

Each error is emitted as `[CODE] message`.

## VX200x Project/Module Graph

- `VX2001` Missing imported `.vx` module.
  - Fix: ensure file exists and relative path resolves within project root.
- `VX2002` Import cycle detected.
  - Fix: break cyclic dependencies by extracting shared module.
- `VX2003` Unknown named import symbol.
  - Fix: import an existing exported symbol or correct spelling.
- `VX2004` Duplicate top-level/export name.
  - Fix: rename conflicting declaration/import alias.
- `VX2005` Default import from `.vx` module not supported.
  - Fix: use named or namespace import.
- `VX2006` No `.vx` files found in input path.
  - Fix: point CLI to directory containing `.vx` files.

## VX300x Semantic/Type Checks

- `VX3001` Imported `@fast` call arity mismatch.
  - Fix: pass the exact number of expected arguments.
- `VX3002` Imported `@fast` obvious type mismatch (expects `i32`).
  - Fix: pass numeric-compatible expressions.
- `VX3003` Imported component called in state expression.
  - Fix: call only imported `@fast` functions in this context.
- `VX3004` Unknown identifier or callable in state expression.
  - Fix: declare or import symbol before use.
- `VX3005` Invalid operand type combination.
  - Fix: align operator usage with operand types.
- `VX3006` Self-referential state initializer.
  - Fix: remove direct self-reference from initializer.
- `VX3007` Forward state reference in initializer.
  - Fix: reorder state declarations or refactor expression.
- `VX3008` Duplicate state declaration in component.
  - Fix: rename one of the duplicated state variables.
- `VX3009` State name collides with param/import local.
  - Fix: choose a unique state variable name.
- `VX3010` Param name collides with imported local.
  - Fix: rename param or import alias.
- `VX3011` Duplicate component param name.
  - Fix: ensure unique parameter names.
- `VX3012` Duplicate imported local alias.
  - Fix: rename one alias or remove duplicate import.
- `VX3013` Duplicate component name in one module.
  - Fix: rename one component.
- `VX3014` Duplicate `@fast` function name in one module.
  - Fix: rename one function.
- `VX3015` Mixed declaration conflict (component vs `@fast` same name).
  - Fix: keep unique names across declaration kinds.
- `VX3016` State name equals component name.
  - Fix: rename state variable.
- `VX3017` Param name equals component name.
  - Fix: rename parameter.
- `VX3018` Empty import clause.
  - Fix: use side-effect import syntax or import symbols.
- `VX3019` Declaration collides with namespace import alias.
  - Fix: rename declaration or namespace alias.
- `VX3020` Non-relative side-effect import restrictions.
  - Fix: use valid package side-effect import usage.
- `VX3021` `.js` import specifier used in `.vx` source.
  - Fix: use `.vx` or extensionless source import.
- `VX3022` Absolute-path import specifier.
  - Fix: use relative or package import path.
- `VX3023` Relative import escapes project root.
  - Fix: keep import path inside project.
- `VX3024` Unsupported relative import extension.
  - Fix: use `.vx` or extensionless relative import.
- `VX3025` Reserved for future package-import policy checks.
  - Fix: n/a in current implementation.
- `VX3026` Orphan route loading module (`*.loading.vx` without page).
  - Fix: add matching page file or remove orphan module.
- `VX3027` Orphan route error module (`*.error.vx` without page).
  - Fix: add matching page file or remove orphan module.
- `VX3028` Orphan route data module (`*.data.js` without page).
  - Fix: add matching page file or remove orphan module.

## VX400x Structural Parse Errors

- `VX4001` Duplicate render block in a component.
  - Fix: keep exactly one render block.
- `VX4002` Component missing render block.
  - Fix: add `render { ... }`.
- `VX4003` Invalid top-level declaration token.
  - Fix: use valid declarations (`import`, `component`, `@fast`).
- `VX4004` Unexpected token in component body.
  - Fix: keep only `~state` and `render` in component body.

## VX410x/VX411x Template Errors

- `VX4101` Unexpected `{:else}` without matching `{#if}`.
- `VX4102` Unexpected `{/if}` without matching `{#if}`.
- `VX4103` Unexpected `{/each}` without matching `{#each}`.
- `VX4104` Unterminated `{#if ...}` directive.
- `VX4105` Invalid if condition syntax.
- `VX4106` Missing `{/if}` after `{:else}`.
- `VX4107` Missing `{/if}` to close if block.
- `VX4108` Unterminated `{#each ...}` directive.
- `VX4109` Invalid each directive shape.
- `VX4110` Missing `{/each}` to close each block.
- `VX4111` Unterminated render binding.
- `VX4112` Invalid render binding identifier.

General fix: validate directive nesting and binding syntax.

## VX420x Import Parse Errors

- `VX4201` Invalid import declaration shape.
- `VX4202` Invalid named import alias usage.
- `VX4203` Missing `from` keyword.
- `VX4204` Missing import source string.
- `VX4205` Namespace import missing `as`.
- `VX4206` Namespace import missing alias.
- `VX4207` Missing `}` in named imports.
- `VX4208` Invalid named import symbol token.

General fix: use valid ES module import syntax accepted by Velox parser.

## VX430x/VX431x/VX432x/VX433x Declaration/Expression Parse Errors

- `VX4301` Missing component name.
- `VX4302` Missing `{` after component header.
- `VX4303` Missing `}` after component body.
- `VX4304` Missing `fast` after `@`.
- `VX4305` Missing `@fast` function name.
- `VX4306` Missing `->` after `@fast` params.
- `VX4307` Missing `@fast` return type.
- `VX4308` Missing `@fast` body block.
- `VX4310` Missing state variable name.
- `VX4311` Missing `=` in state declaration.
- `VX4321` Missing `(` in parameter list.
- `VX4322` Missing parameter name.
- `VX4323` Missing parameter type.
- `VX4324` Missing `:` and parameter type.
- `VX4325` Missing `)` after parameters.
- `VX4331` Missing `)` after call arguments.
- `VX4332` Missing `)` after expression.
- `VX4333` Missing expression.
- `VX4334` Unterminated block.

General fix: correct declaration punctuation and balanced delimiters.
