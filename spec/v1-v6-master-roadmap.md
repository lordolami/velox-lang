# Velox v1-v6 Master Roadmap

Version: 1.0  
Status: Active  
Last Updated: 2026-04-12

## Purpose

Define the full execution model from `v1` through `v6` so Velox can move from stable language/runtime to full AI-native platform.

## Baseline Principles

1. No performance claim without reproducible benchmark artifacts.
2. No syntax expansion without diagnostics + docs in the same release.
3. Every version milestone must ship with automated quality gates.
4. Backward compatibility policy must be explicit per major version.

## Version Ladder

### v1 - Stable Core (target window: April 12, 2026 to June 30, 2026)

Goal:
- Ship a reliable, documented, externally usable Velox core.

Must ship:
- Stable compiler/runtime/router behavior.
- Published npm package and VS Code extension.
- Complete docs set and machine-readable docs index.
- CI gates for build/test/ai/perf.

Acceptance gates:
- `npm run build`
- `npm test`
- `npm run bench:ai`
- `npm run bench:fast`
- `npm run bench:apps`

KPIs:
- CI pass rate >= 99% on `main`.
- Fresh-machine quickstart <= 15 minutes.
- At least 3 external demo apps compiled and running.

### v2 - Pro DX + Strong Types (target window: July 1, 2026 to October 31, 2026)

Goal:
- Scale developer productivity and correctness.

Must ship:
- Property/index expression support (`obj.key`, `arr[i]`).
- Nested object/array inference and stronger diagnostics.
- True language server architecture (client/server split).
- Cross-file definition/references and rename support.

Acceptance gates:
- End-to-end language server tests.
- Cross-file symbol resolution tests.
- Zero known P1 diagnostics regressions vs v1.

KPIs:
- LSP median hover/definition response < 100ms on medium project.
- Compiler false-positive diagnostic rate < 2% in curated corpus.

### v3 - Framework Maturity (target window: November 1, 2026 to February 28, 2027)

Goal:
- Make Velox framework production-ready for larger apps.

Must ship:
- SSR/SSG RFC and minimum viable implementation.
- Hydration contract and runtime boundaries.
- Plugin hooks for compile-time transforms.
- Expanded routing/data/error/load conventions.

Acceptance gates:
- Framework integration suite green across official examples.
- Router + data lifecycle tests on Windows/macOS/Linux.

KPIs:
- Route transition regressions < 1% per release train.
- Deterministic static output for fixed input commits.

### v4 - Cloud Platform (target window: March 1, 2027 to June 30, 2027)

Goal:
- Offer first-class hosted deployment workflow.

Must ship:
- Real cloud deploy target(s), not only local artifacts.
- Preview environments with unique URLs.
- Deploy logs, status API, rollback primitives.
- Team/project environment configuration model.

Acceptance gates:
- Deploy/rollback test matrix in CI.
- Artifact integrity checks and manifest verification.

KPIs:
- Preview deploy p50 < 60 seconds for showcase apps.
- Rollback success rate >= 99%.

### v5 - AI-Native Build Platform (target window: July 1, 2027 to October 31, 2027)

Goal:
- Make Velox the default target for deterministic frontend generation.

Must ship:
- Stable AI-facing compiler/spec contracts.
- Prompt-to-code-to-preview pipeline with deterministic checks.
- Correction feedback loop from edits to training signals.
- Reliability benchmark expansion for long-form generated apps.

Acceptance gates:
- AI suite pass rate >= 98% across valid/invalid corpora.
- Deterministic generation validation for approved prompt set.

KPIs:
- Median prompt-to-live-preview latency < 5 seconds.
- Human correction rate decreases release-over-release.

### v6 - Full Completion (target window: November 1, 2027 to March 31, 2028)

Goal:
- Reach long-horizon platform maturity and enterprise readiness.

Must ship:
- LTS policy and support windows.
- Security hardening and governance model.
- Self-hosting and enterprise deployment guidance.
- Mature ecosystem templates/integrations.

Acceptance gates:
- Long-run soak tests.
- Security review checklist complete.
- Stability SLO met for 90-day period.

KPIs:
- Zero P0 regressions for 90 consecutive days.
- Enterprise pilot success on at least 2 external teams.

## Workstreams (cross-version)

1. Language and Compiler
2. Framework and Runtime
3. Tooling and Editor (LSP)
4. Performance and Benchmarking
5. Cloud and Deployment
6. AI Platform and Reliability
7. Docs, Adoption, and Governance

Each milestone must map to exactly one owning workstream and one measurable acceptance test.

## Current Start Position (as of April 12, 2026)

- v1: in late stabilization phase with passing build/test/benchmark gates.
- v2: started (object literal/type expansion, stronger editor intelligence, app-level benchmarks).
- v3-v6: modeled, not yet implemented.

## Risk Register (top)

1. Ecosystem interoperability gaps.
2. Editor intelligence complexity outgrowing extension-host-only model.
3. Performance regressions from framework growth.
4. Cloud platform operational complexity.
5. AI output drift without strict deterministic validation.

## Immediate Next Slice (next 14 days)

1. Lock v1 release branch and freeze surface area.
2. Start v2 property/index AST + parser + checker + codegen.
3. Scaffold standalone LSP server package and protocol contract.
4. Add CI thresholds for `bench:apps` regression alerts.
