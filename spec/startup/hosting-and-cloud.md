# Hosting and Cloud Targets

Velox now supports cloud-ready deployment bundle generation:

```bash
velox deploy <project-dir> --target local
velox deploy <project-dir> --target vercel
velox deploy <project-dir> --target netlify
velox deploy <project-dir> --target cloudflare-pages
```

## Output

Each deploy creates:

1. Build output copy
2. Manifest (`velox-deploy.json` or `velox-cloud-deploy.json`)
3. `DEPLOY.md` with provider-specific final command

## Provider Notes

1. Vercel bundle includes `vercel.json`.
2. Netlify bundle includes `netlify.toml`.
3. Cloudflare Pages bundle includes `_headers`, `_redirects`, and `wrangler.toml.example`.

