# Velox Web Runbook

This runbook covers reliability checks for the official Velox site app at `apps/velox-web`.

## Scope

1. Route/app compile integrity.
2. Build artifact integrity.
3. Multi-target deploy bundle integrity.
4. Inclusion in app-level benchmark suite.

## Gate Command

```bash
npm run check:velox-web
```

The gate verifies:

1. `velox check apps/velox-web`
2. `velox build apps/velox-web`
3. Output artifacts (`index.html`, router module, route JS, CSS, build manifest)
4. Deploy bundles for:
   - local
   - vercel
   - netlify
   - cloudflare-pages

## Data Accuracy Contract

Route data modules for critical pages:

1. `pages/index.data.js`
2. `pages/benchmarks.data.js`
3. `pages/docs/index.data.js`
4. `pages/quickstart.data.js`
5. `pages/ai-build.data.js`
6. `pages/showcase.data.js`

These are the single source of truth for textual metrics shown in the frontend.

