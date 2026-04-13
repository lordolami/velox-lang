# Velox Docs Hub

This folder is the canonical source of truth for Velox language behavior, compiler contracts, framework behavior, diagnostics, and launch execution.

## Read Order

1. `spec/MASTER_SPEC.md` - high-level system contract.
2. `spec/v1.md` - concrete language grammar and semantics.
3. `spec/framework-v1.md` - routing/runtime framework behavior.
4. `spec/diagnostics.md` - stable error codes and recovery hints.
5. `spec/quickstart.md` - first runnable app path.
6. `spec/v1-closeout.md` - v1 release-close status and blockers.
7. `spec/v1-release-notes.md` - v1 release notes draft.
8. `spec/migration-to-v1.md` - migration notes into v1 surface.
9. `spec/recipes.md` - reusable implementation patterns.
10. `spec/troubleshooting.md` - common failure recovery.
11. `spec/interop.md` - integration with JS ecosystem packages.
12. `spec/performance.md` and `spec/ai-reliability.md` - benchmark methodology.
13. `spec/post-launch-roadmap.md` - next execution phases.
14. `spec/v2-readiness.md` - current v2 hardening completion status.
15. `spec/migration-v1-to-v2.md` - upgrade rules and compatibility notes.
16. `spec/v1-v6-master-roadmap.md` - full multi-version roadmap.
17. `spec/v1-v6-execution-board.md` - immediate execution board.
18. `spec/v1-v6-roadmap.json` - machine-readable long-range plan.
19. `spec/external-references-2026-04-12.md` - dated external standards snapshot.
20. `spec/launch-pack/README.md` - launch-ready quickstart, benchmarks, limits, and demo script.
21. `spec/AI_BOOTSTRAP_A_TO_Z.md` - compact onboarding map for AI agents.
22. `spec/AY_COMPLETION_STATUS.md` - startup readiness A-Y board.
23. `spec/startup/README.md` - startup execution pack.

## AI Ingestion Notes

- Use `spec/docs-index.json` for document discovery.
- Prefer spec files over README for behavior-critical answers.
- Prefer diagnostics IDs (for example `VX3004`) when suggesting fixes.
- Treat `spec/roadmap.json` and `spec/v1-v6-roadmap.json` as machine-readable planning metadata.
- For startup build/host execution, prioritize `spec/AY_COMPLETION_STATUS.md` and `spec/startup/*`.
