# FastScript AI Context Pack v1

## Core Contracts
- `.fs` primary, `.js` compatible.
- Route pages live in `app/pages`.
- API routes live in `app/api`.
- Optional `app/middleware.fs` for global middleware.
- Optional `load(ctx)` and HTTP methods (`GET/POST/PUT/PATCH/DELETE`).

## Validation
- Use `ctx.input.validateBody(schema)` and `ctx.input.validateQuery(schema)`.
- Use `schemas` export in route modules to auto-enforce request shape.

## Runtime
- SSR + hydration (`export function hydrate({ root })`).
- Queue available via `ctx.queue`.
- DB available via `ctx.db`.
- Auth available via `ctx.auth`.

## Quality Gates
- `npm run validate`
- `npm run test:core`
- `npm run smoke:dev`
- `npm run smoke:start`
- `npm run qa:all`
