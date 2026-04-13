# FastScript Plugin API Contract

## Hook Surface
- `middleware(ctx, next)`
- `onBuildStart(ctx)`
- `onBuildEnd(ctx)`
- `onRequestStart(ctx)`
- `onRequestEnd(ctx)`

## Plugin Shape
```js
export default {
  name: "my-plugin",
  setup(api) {
    api.hooks.middleware(async (ctx, next) => next());
  }
}
```

## Stability
- Contract version: `1`.
- Breaking changes require major version bump.
