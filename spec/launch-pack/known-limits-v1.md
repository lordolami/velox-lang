# Known Limits (v1)

1. `@fast` targets numeric kernels (`i32`) and is not a full general-purpose Wasm backend yet.
2. Default imports from relative `.vx` modules are rejected; named/namespace imports are supported.
3. Side-effect CSS import support exists, but broader style pipelines (PostCSS/Tailwind plugins) are not first-class.
4. Router/data conventions are file-based and opinionated; advanced server-runtime features are out of scope in v1.
5. Marketplace extension is syntax + language tooling baseline; deeper refactors and richer semantic intelligence continue in v2.
