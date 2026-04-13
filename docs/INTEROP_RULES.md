# FastScript Interop Rules

1. Prefer ESM imports.
2. CJS is supported via esbuild bundling.
3. `.fs` can import `.js/.mjs/.cjs/.json`.
4. `importAny()` handles default-only modules.
5. Use `resolveExport(mod, ["named", "default"])` for unknown module shapes.
