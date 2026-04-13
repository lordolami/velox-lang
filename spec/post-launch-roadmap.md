# Velox Post-Launch Roadmap

Version: 1.0  
Status: Active  
Last Updated: 2026-04-12

## Goal

Turn Velox from "launched project" into a trusted, AI-ready frontend platform with measurable adoption, stability, and performance wins.

## Phase 1: Days 0-30 (Stabilize + Onboard)

### Product and Compiler

- Freeze v1 grammar surface except for bug fixes.
- Close top 20 diagnostics clarity gaps from real user reports.
- Add parser/codegen snapshot suites for regression protection.

### Framework and Runtime

- Harden router edge cases (404, nested layout fallback, redirect loops).
- Add deterministic route manifest tests on Windows/macOS/Linux CI.

### Docs and DX

- Ship a docs landing map (`spec/README.md`) and canonical framework spec.
- Record a "15-minute quickstart" flow from zero to deploy.
- Ensure first-time `velox init -> velox dev -> velox build` is under 5 minutes.

### Success Criteria

- CI pass rate >= 99% on `main`.
- New user success run (fresh machine) in <= 15 minutes.
- At least 3 external builders ship non-trivial demo apps.

## Phase 2: Days 31-60 (Adoption + Ecosystem)

### Ecosystem

- Publish stable npm release tags with changelogs.
- Publish VS Code extension to Marketplace with versioned release notes.
- Add official integrations cookbook (charts, auth, forms, payments).

### AI Reliability

- Expand `ai-suite` with long-form generated apps and invalid-fuzz corpus.
- Require `bench:ai` to stay >= 98% pass before release cut.

### Growth

- Launch official examples gallery and benchmark dashboard.
- Run public "build week" challenge for early adopters.

### Success Criteria

- 25+ GitHub stars from real external users (not launch spike only).
- 10+ opened/closed external issues showing active usage.
- 5+ community-built starter templates.

## Phase 3: Days 61-90 (Scale + Differentiation)

### Performance and Runtime

- Add expanded `@fast` typing support beyond `i32` (prioritize numeric types that keep compilation simple).
- Reduce runtime helper overhead on large list updates.
- Publish repeatable benchmarks against mainstream frontend baselines with methodology.

### Framework Expansion

- Design SSR/SSG RFC and implement minimum viable static pre-render pipeline.
- Add plugin hooks for compile-time transforms.

### Platform and Operations

- Create release trains (weekly canary, monthly stable).
- Add telemetry-safe performance opt-in for real-world baseline capture.

### Success Criteria

- Median `bench:fast` speedup target: >= 2.5x on CPU kernels.
- Weekly canary adoption with rollback path validated.
- Stable release SLA: no P0 regressions for 30 consecutive days.

## Ongoing Rules

- No marketing claims without benchmark evidence.
- No syntax expansion without docs and diagnostics updates in same PR.
- Any release candidate must pass:
  - `npm run build`
  - `npm test`
  - `npm run bench:ai`
  - `npm run bench:fast`

## Ownership Matrix

- Language/compiler correctness: core compiler track
- Framework/runtime behavior: framework track
- Docs and AI consumability: docs track
- Release and adoption operations: growth track

Each feature item should map to exactly one owner and one acceptance test.
