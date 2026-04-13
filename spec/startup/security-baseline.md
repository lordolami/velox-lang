# Security Baseline

## Rules

1. No secrets in `.vx`, `.md`, or committed JSON configs.
2. Validate all external input in `.data.js` modules.
3. Keep dependencies updated and pinned via lockfile.
4. Gate release on full quality checks.

## Release Security Checklist

1. `npm run startup:ready` passes.
2. Review generated output for accidental secret exposure.
3. Confirm host env vars are configured in provider dashboard.
4. Confirm HTTPS-only deployment URL.

