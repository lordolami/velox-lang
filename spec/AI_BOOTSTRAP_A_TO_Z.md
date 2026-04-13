# Velox AI Bootstrap (A to Z)

A. **Architecture**: Read `spec/MASTER_SPEC.md` and `spec/framework-v1.md`.
B. **Build**: Run `npm run build`.
C. **CLI**: Use `velox init`, `velox dev`, `velox build`, `velox preview`, `velox deploy`.
D. **Docs Index**: Parse `spec/docs-index.json` for machine-readable doc discovery.
E. **Examples**: Start from `examples/counter.vx`, then `examples/showcase/*`, then `examples/mega60/*`.
F. **Framework Rules**: Follow page/layout/data conventions in `spec/framework-v1.md`.
G. **Grammar**: Source grammar lives in `src/lexer.ts` and `src/parser.ts`.
H. **Hot Reload**: Dev loop is powered by `src/dev-server.ts`.
I. **Interop**: Use JS/data interop patterns from `spec/interop.md` and `examples/interop/*`.
J. **JSON Config**: Project config is `velox.config.json`.
K. **Known Limits**: Respect `spec/launch-pack/known-limits-v1.md`.
L. **Language Intelligence**: LSP is in `vscode/velox-language/lsp/server.js`.
M. **Migration**: Check `spec/migration-to-v1.md` and `spec/migration-v1-to-v2.md`.
N. **NPM Package**: Tooling contract is in root `package.json`.
O. **Optimization Gates**: Run `bench:fast:gate` and `bench:apps:gate`.
P. **Publish Runbook**: Follow `spec/publish-runbook.md`.
Q. **Quickstart**: Start with `spec/quickstart.md`.
R. **Release Gate**: Run `npm run release:v1:check`.
S. **Starter Template**: Bootstrap from `starter/v1-starter`.
T. **Tests**: Run `npm test` (currently 183 tests passing).
U. **Uppercase Support**: `.vx` and `.VX` are both supported.
V. **VS Code Extension**: Package lives in `vscode/velox-language`.
W. **Wasm Path**: Use `@fast` conventions and benchmark scripts in `benchmarks/`.
X. **Execution Board**: Track roadmap in `spec/v1-v6-execution-board.md`.
Y. **Yield Determinism**: Run `npm run check:deterministic`.
Z. **Zero-to-Deploy Check**: Run `npm run verify:quickstart` end-to-end.

## Minimal Command Pack For Any AI Agent

1. `npm install`
2. `npm test`
3. `npm run build`
4. `npm run lsp:gate`
5. `npm run release:v1:check`

