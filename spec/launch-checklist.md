# Velox Launch Checklist

Use this as the execution board from build to public launch.
Rule: do not mark a section complete until every item inside is checked.

## 1) Spec Lock (Week 1)
- [x] `spec/v1.md` exists and defines lexer/parser grammar with examples.
- [x] AST node schema is documented and versioned.
- [x] Compiler error code catalog exists with human-readable fixes.
- [x] Runtime contract is documented (`mount`, state updates, routing hooks).
- [x] JS + Wasm target behavior is explicitly defined.
- [x] No unresolved "TBD" items in v1 spec files.
- Exit criteria:
- [ ] Zero ambiguity review passed (2 independent read-throughs).

## 2) Compiler Core (Weeks 1-3)
- [x] Lexer is deterministic and snapshot-tested.
- [x] Parser builds valid AST for all core syntax.
- [x] Semantic/type validation catches core misuse patterns.
- [x] JS codegen works for components, state, events, imports.
- [x] Build output is deterministic across repeated runs.
- [ ] Diagnostics include file path + line + code + fix hint.
- Exit criteria:
- [x] `velox build` succeeds on all official examples.

## 3) Framework Runtime (Weeks 2-4)
- [ ] Reactive `~state` updates DOM correctly.
- [ ] Component composition/props behavior is stable.
- [x] Router supports static/dynamic/catch-all routes.
- [x] Layout and nested layout composition works.
- [x] 404, loading, and error boundaries render correctly.
- [x] Route data loading lifecycle is documented and tested.
- Exit criteria:
- [x] Counter, Todo, Dashboard apps run with no manual JS edits.

## 4) Wasm Fast Path (Weeks 3-5)
- [ ] `@fast` annotation compiles into callable wasm path.
- [ ] Fallback path works when Wasm is unavailable.
- [ ] Host/runtime bridge handles typed inputs/outputs.
- [ ] Build pipeline emits and serves `.wasm` with correct references.
- [x] Perf benchmarks include CPU-heavy tasks and are reproducible.
- Exit criteria:
- [x] At least one benchmark shows meaningful speedup vs pure JS.

## 5) CLI + Developer Experience (Weeks 4-6)
- [x] `velox init` scaffolds ready-to-run projects.
- [x] `velox dev` supports rapid reload workflow.
- [x] `velox build` production output is stable.
- [x] `velox check` validates compile correctness without emit.
- [x] `velox preview` serves production output locally.
- [x] `velox deploy` produces a verifiable deployment artifact.
- Exit criteria:
- [x] New user path: "install -> init -> dev -> build -> preview" in <5 min.

## 6) Editor Support (Weeks 5-6)
- [x] VS Code extension detects `.vx` files automatically.
- [ ] Syntax highlighting covers full v1 language surface.
- [x] Snippets exist for component/state/fast function patterns.
- [x] Diagnostics surface compile errors inline.
- [x] Basic autocomplete works for keywords/components.
- Exit criteria:
- [ ] First-time VS Code setup is documented and validated by a fresh machine.

## 7) Interop + Ecosystem Bridge (Weeks 5-7)
- [x] npm package imports are supported/documented.
- [x] JS interop boundary pattern is documented with examples.
- [x] At least one charting integration example works.
- [x] At least one payments or external API integration example works.
- [x] Known compatibility limits are listed clearly.
- Exit criteria:
- [ ] Third-party libs can be used in a real demo without hacks.

## 8) AI-Ready Docs + Spec (Weeks 6-8)
- [x] Canonical language spec is complete and linkable.
- [x] "Learn Velox" quickstart exists with runnable examples.
- [x] Recipe docs cover common UI patterns and data flows.
- [x] Troubleshooting/error reference is complete for common failures.
- [x] Machine-readable docs index exists (for RAG/agents).
- [x] AI reliability benchmark exists for valid/invalid generation patterns.
- [x] Docs hub and framework spec are published for human + AI onboarding.
- Exit criteria:
- [ ] External LLM can generate valid sample apps from docs only.

## 9) Quality Gates (Continuous)
- [x] Unit tests run in CI on every PR.
- [x] Integration tests verify end-to-end compile/run behavior.
- [x] Snapshot tests protect parser/codegen regressions.
- [x] Perf tests track key baseline metrics over time.
- [x] Release requires all checks green.
- Exit criteria:
- [ ] No red CI on `main` at release cut.

## 10) Launch Package (Weeks 8-9)
- [x] README has install, quickstart, examples, roadmap.
- [ ] Homepage is live and built with Velox output.
- [ ] Public npm package published.
- [x] Benchmarks are published with methodology.
- [x] "Why Velox" and migration guidance are documented.
- [ ] Launch posts drafted (X, HN, dev communities).
- [x] Post-launch 90-day roadmap is published in spec + machine JSON.
- Exit criteria:
- [ ] Public launch can be completed in one day without blockers.

---

## Hard Launch Criteria (Must Be True)
- [x] 3 production-like demo apps are fully built in Velox.
- [x] Stable CLI and documented deployment flow are complete.
- [x] Interop with key JS libraries is proven.
- [x] Performance claims are benchmark-backed and reproducible.
- [ ] Docs are sufficient for external developers to build unaided.

## Daily Progress Board
- Date:
- Focus area:
- Wins shipped today:
- Risks discovered:
- Next 24-hour target:

## Percent Complete Formula
Use weighted progress to avoid fake 90% states.

- Spec Lock: 10%
- Compiler Core: 20%
- Framework Runtime: 15%
- Wasm Fast Path: 10%
- CLI + DX: 10%
- Editor Support: 10%
- Interop: 10%
- AI Docs: 10%
- Quality + Launch package: 5%

Total completion % = sum of completed section weights.
