# Velox Troubleshooting

## Build fails with `[VX2001] Missing imported .vx module`

Cause:
- Relative import target does not exist.

Fix:
- Confirm file path and extension (`.vx` or extensionless in source).
- Keep import inside project root.

## Build fails with `[VX2002] Import cycle detected`

Cause:
- Module A imports B and B imports A (directly or indirectly).

Fix:
- Move shared logic to a third module.

## Build fails with `[VX3021] ... uses .js specifier`

Cause:
- `.vx` source imports `./file.js`.

Fix:
- Use `./file.vx` or extensionless `./file` in `.vx` source.

## Build fails with `[VX3004] Unknown identifier/callable`

Cause:
- State initializer references undeclared symbol.

Fix:
- Declare it as param/import/state in valid order.

## Build fails with `[VX3005] Invalid operand types`

Cause:
- Unsupported type combination for unary/binary operator.

Fix:
- Use compatible numeric/boolean/string operator combinations.

## Parser fails around template directives (`VX410x`, `VX411x`)

Cause:
- Unbalanced or malformed `{#if}`, `{:else}`, `{/if}`, `{#each}`, `{/each}`, or bindings.

Fix:
- Ensure directives are properly opened/closed and binding names are identifiers.

## Route build fails with orphan modules (`VX3026`, `VX3027`, `VX3028`)

Cause:
- `*.loading.vx`, `*.error.vx`, or `*.data.js` file has no matching page `.vx`.

Fix:
- Add sibling page module or remove orphan support file.

## Runtime error: `Velox mount(target): target must be a DOM Element`

Cause:
- Component mounted to invalid target.

Fix:
- Pass a real DOM element from `document.getElementById(...)` etc.

## Route not found in preview/dev

Cause:
- No matching file-based route or missing `pages/index.vx`.

Fix:
- Add route file or `pages/404.vx` fallback.
