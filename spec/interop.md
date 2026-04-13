# Velox JS Interop Guide

## Goal

Use existing JavaScript/npm ecosystem while writing UI in `.vx`.

## Supported Today

### 1) Package Imports in `.vx`

Velox supports non-relative value imports:

```vx
import { Chart } from "chart.js/auto"
import { loadStripe } from "@stripe/stripe-js"
```

Compiler behavior:
- Package imports are preserved in generated JS.
- Symbol validation is skipped for package specifiers.

### 2) Route/Data Boundary with `.data.js`

Use sibling `*.data.js` files for API and package-heavy logic.

Example:

```js
// pages/dashboard.data.js
export async function load(ctx) {
  const res = await fetch("https://api.example.com/data");
  const json = await res.json();
  return { data: JSON.stringify(json) };
}
```

Then in `.vx` page:

```vx
component Dashboard(data) {
  render { <pre>{data}</pre> }
}
```

This keeps UI simple while letting JS modules handle integration detail.

### 3) Relative CSS Side-Effect Imports

Supported:

```vx
import "./styles.css"
```

Build behavior:
- validates CSS path exists within project root
- copies CSS file into output directory preserving relative path

## Interop Patterns

1. Keep UI composition in `.vx`.
2. Put third-party SDK initialization in `.data.js` or regular JS modules.
3. Pass simplified values into components (`string`, `number`, flags, etc).

## Known Compatibility Limits (Current)

1. `.vx` source cannot import relative `.js` directly (`VX3021`).
2. Package symbol existence is not type-checked by Velox compiler yet.
3. Runtime behavior for package imports depends on your bundler/host resolving those packages.

## Proof Examples

See:
- `examples/interop/chart.vx`
- `examples/interop/payments.vx`
- `examples/interop/api-page.vx`
- `examples/interop/api-page.data.js`
