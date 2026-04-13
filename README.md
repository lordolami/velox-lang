# FastScript

FastScript is a JavaScript-first full-stack framework focused on three things:

- Simpler than heavy framework stacks
- Faster build and runtime pipeline
- Compatible with existing JavaScript ecosystem
- `.fs` first, `.js` always supported

## Commands

```bash
npm install
npm run create
npm run dev
npm run start
npm run build
npm run check
npm run migrate
npm run bench
npm run export:js
npm run export:ts
npm run compat
npm run validate
npm run db:migrate
npm run db:seed
npm run smoke:dev
npm run smoke:start
npm run test:core
npm run bench:report
npm run qa:all
npm run worker
npm run deploy:node
npm run deploy:vercel
npm run deploy:cloudflare
npm run release:patch
npm run pack:check
```

- `npm run migrate`: convert `app/pages` files (`.js/.jsx/.ts/.tsx`) to `.fs`
- `npm run bench`: enforce 3G-oriented gzip budgets on built output
- `npm run export:js`: export `.fs` app source to plain `.js` project
- `npm run export:ts`: export `.fs` app source to `.ts` project
- `npm run compat`: run ESM/CJS/FS interop smoke checks
- `npm run db:migrate`: run database migrations from `app/db/migrations`
- `npm run db:seed`: seed database from `app/db/seed.js`
- `npm run validate`: run full quality gate (check/build/bench/compat/db/export)
- `npm run smoke:dev`: automated SSR/API/auth/middleware smoke test
- `npm run smoke:start`: production `fastscript start` smoke test
- `npm run test:core`: middleware/auth/db/migration round-trip tests
- `npm run bench:report`: writes benchmark report to `benchmarks/latest-report.md`
- `npm run qa:all`: full quality sweep in one command
- `npm run worker`: run queue worker runtime
- `npm run deploy:*`: generate deploy adapters for node/vercel/cloudflare
- `npm run release:*`: semver bump + changelog append
- `npm run pack:check`: npm publish dry-run

## Additional Docs

- `docs/AI_CONTEXT_PACK_V1.md`
- `docs/PLUGIN_API_CONTRACT.md`
- `docs/INCIDENT_PLAYBOOK.md`
- `docs/DEPLOY_GUIDE.md`

## Project layout

```txt
app/
  pages/
    _layout.fs
    index.fs
    404.fs
  api/
    hello.js
    auth.js
  db/
    migrations/
      001_init.js
    seed.js
  middleware.fs
  styles.css
```

## Page contract

- `export default function Page(ctx) { return htmlString }`
- Optional `export async function load(ctx) { return data }`
- Optional method actions in page files: `POST/PUT/PATCH/DELETE`
- `.fs` supports lenient FastScript syntax such as `~state = value`
- Optional `export function hydrate({ root, ...ctx })` for client hydration

## Routing

- `app/pages/index.fs` or `index.js` -> `/`
- `app/pages/blog/index.fs` or `index.js` -> `/blog`
- `app/pages/blog/[slug].fs` or `[slug].js` -> `/blog/:slug`
- `app/pages/404.fs` or `404.js` -> not found view
- `app/pages/_layout.fs` or `_layout.js` -> global layout wrapper

## Why this reset

This repo was reset intentionally to rebuild from ground up around a JavaScript-first model with minimal syntax friction.
