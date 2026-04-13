# Environment and Secrets

## Baseline

Velox compiles frontend artifacts. Secrets must never be hardcoded into `.vx` files.

## Rules

1. Put non-secret config in `velox.config.json`.
2. Put secrets in `.env` (never commit).
3. Commit `.env.example` with required keys only.
4. In route data modules (`*.data.js`), read secrets via `process.env`.

## Example

```env
VITE_API_BASE_URL=https://api.example.com
PUBLIC_STRIPE_KEY=pk_test_change_me
PRIVATE_SERVICE_TOKEN=change_me
```

## Rotation

1. Rotate keys monthly or after incident.
2. Use host dashboard secrets for production (Vercel/Netlify/Cloudflare), not local `.env` files.

