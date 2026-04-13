# Velox v1-v6 Execution Board

Updated: 2026-04-12

## Now (Start Immediately)

1. v1 release freeze prep:
- Lock syntax/runtime surface and mark non-critical items for v2.
- Final pass on docs consistency and benchmark reproducibility.

2. v2 technical kickoff:
- Add parser/codegen support for `obj.key` and `arr[i]`.
- Extend inference/checker for nested object/array structures.
- Define language-server process boundary and transport.

3. Quality gate hardening:
- Add benchmark threshold checks for `bench:apps`.
- Add release check to block merge on missing benchmark artifacts.

## Next (After v1 tag)

1. Publish v1:
- npm, VS Code Marketplace, release notes, migration notes.

2. LSP server implementation:
- Create `client` and `server` packages.
- Move current intelligence logic to server-side analysis engine.

3. v2 validation:
- Cross-file symbol integration tests.
- Rename/refactor safety tests.

## Later (v3-v6 tracks)

1. v3:
- SSR/SSG RFC and implementation spike.

2. v4:
- Cloud deploy MVP and preview URL flow.

3. v5:
- AI deterministic generation pipeline and feedback loop.

4. v6:
- LTS/governance/security completion.

## Weekly Cadence

1. Monday: define acceptance tests for the week.
2. Wednesday: mid-week benchmark and reliability check.
3. Friday: release candidate cut and gate review.
