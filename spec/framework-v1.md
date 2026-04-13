# Velox Framework Spec (v1)

Version: 1.0-draft  
Status: Active  
Last Updated: 2026-04-12

## 1) Scope

This spec defines the Velox framework layer built on top of `.vx` language compilation:

- File-based routing
- Layout composition
- Route data loading
- Loading/error boundaries
- Link navigation behavior
- Build output contract for deployment

## 2) File-Based Routing

Root convention: app routes live under `pages/`.

Route mapping:

- `pages/index.vx` -> `/`
- `pages/about.vx` -> `/about`
- `pages/blog/[slug].vx` -> `/blog/:slug`
- `pages/docs/[...rest].vx` -> `/docs/*rest`
- `pages/404.vx` -> not-found fallback
- `pages/(group)/pricing.vx` -> `/pricing` (group removed from URL)

## 3) Layouts

Layout files:

- Global layout: `pages/_layout.vx`
- Segment layout: `pages/blog/_layout.vx`

Layout components can accept a content slot by naming one of:

- `content`
- `children`
- `child`
- `slot`

Nested layouts wrap from outer to inner segment.

## 4) Route Data

Data module convention:

- `pages/blog/[slug].data.js` pairs with `pages/blog/[slug].vx`

Data contract:

- Export `load(ctx)` or default function.
- Return value is passed into page as `data`.
- Control signals supported:
  - `{ redirect: "/login" }`
  - `{ notFound: true }`
  - `{ error: "message" }`

## 5) Loading/Error Boundaries

Sibling conventions:

- `*.loading.vx`
- `*.error.vx`

Rules:

- They must match an existing page module.
- Orphans fail with:
  - `VX3026` for loading modules
  - `VX3027` for error modules
  - `VX3028` for data modules

## 6) Router Runtime Behavior

- Generated runtime artifact: `__velox_router.js`
- Internal link prefetch on hover/focus
- SPA navigation with history support
- Query/hash passthrough
- 404 fallback to route component or hard fallback markup

Route context injection by param name:

- `params`
- `query`
- `pathname`
- `path`
- `search`
- `hash`
- `url`

## 7) Build Output Contract

For router-mode builds, output includes:

- `index.html`
- `__velox_router.js`
- compiled route modules (`.js`)
- copied `public/` assets
- copied relative CSS side-effect imports
- `velox-manifest.json`

## 8) Deployment Compatibility

Deploy target requirements:

- Static file hosting support
- SPA rewrite or fallback to `index.html`
- MIME support for `.wasm` if `@fast` output exists

Velox-compatible targets include local preview, Vercel-style static deployments, Netlify-style static deployments, and CDN-backed object stores with rewrite rules.

CLI deploy bundle targets:

- `velox deploy --target local`
- `velox deploy --target vercel`
- `velox deploy --target netlify`
- `velox deploy --target cloudflare-pages`

Cloud targets emit provider-ready config files and `DEPLOY.md` instructions in deployment output.

## 9) Non-Goals for v1

- SSR and streaming server rendering
- Edge functions contract
- full auth/session primitives
- built-in ORM or backend runtime
