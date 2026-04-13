# Velox v1 Closeout

Date: 2026-04-13  
Status: In Progress (Manual publish steps pending)

## Objective

Close v1 with reproducible engineering gates and explicit release blockers.

## Completed Engineering Gates

1. Build and test gates are automated.
2. AI reliability gate is automated.
3. Fast-kernel and app-level perf gates are automated.
4. LSP smoke and perf gates are automated.
5. Deterministic output gate is automated.
6. Quickstart flow timing is automated.
7. Aggregate release gate command exists:
   - `npm run release:v1:check`

## Manual Release Steps Remaining

1. Publish npm package.
2. Publish VS Code extension to Marketplace.
3. Tag release and publish final release notes/changelog.
4. Record external adoption KPIs after launch window opens.

## Release-Readiness Command

```bash
npm run release:v1:check
```

Report artifact output:

- `spec/reports/v1-release-readiness-<timestamp>.json`

## Definition of Done for v1

v1 is considered fully closed when:

1. `release:v1:check` passes on CI/main.
2. npm + VS Code extension are publicly published.
3. Release tag + notes are public.
4. Post-release KPI tracking has started.
