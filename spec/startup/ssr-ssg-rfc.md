# SSR/SSG RFC (v3 Track)

Status: Draft RFC  
Target: v3 framework maturity

## Why

For startup scale, static generation and server-rendered entry paths improve SEO and first paint.

## Proposed Minimum

1. SSG for static routes at build time.
2. SSR entry adapter with hydration boundary contract.
3. Route-level switch (`static`, `server`, `client`).

## Non-Goals in Current Cycle

1. Full streaming SSR.
2. Edge function orchestration.

## Exit Criteria

1. RFC accepted.
2. Prototype compiles one showcase app in SSG mode.
3. Hydration mismatch test suite added.

