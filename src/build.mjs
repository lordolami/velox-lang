import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import esbuild from "esbuild";
import { normalizeFastScript } from "./fs-normalize.mjs";

const APP_DIR = resolve("app");
const PAGES_DIR = join(APP_DIR, "pages");
const API_DIR = join(APP_DIR, "api");
const DIST_DIR = resolve("dist");

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function fsLoaderPlugin() {
  return {
    name: "fastscript-fs-loader",
    setup(build) {
      build.onLoad({ filter: /\.fs$/ }, async (args) => {
        const { readFile } = await import("node:fs/promises");
        const raw = await readFile(args.path, "utf8");
        return {
          contents: normalizeFastScript(raw),
          loader: "js",
        };
      });
    },
  };
}

function routeFromPageFile(file) {
  const rel = relative(PAGES_DIR, file).replace(/\\/g, "/").replace(/\.(js|fs)$/, "");
  if (rel === "index") return "/";
  const segs = rel.split("/").filter(Boolean);
  if (segs.at(-1) === "index") segs.pop();
  return "/" + segs.map((s) => (s.startsWith("[") && s.endsWith("]") ? `:${s.slice(1, -1)}` : s)).join("/");
}

function routeFromApiFile(file) {
  const rel = relative(API_DIR, file).replace(/\\/g, "/").replace(/\.(js|fs)$/, "");
  const segs = rel.split("/").filter(Boolean);
  if (segs.at(-1) === "index") segs.pop();
  return "/api/" + segs.join("/");
}

async function compileFile(file, out, platform) {
  mkdirSync(dirname(out), { recursive: true });
  await esbuild.build({
    entryPoints: [file],
    outfile: out,
    bundle: true,
    format: "esm",
    platform,
    sourcemap: true,
    minify: platform === "browser",
    logLevel: "silent",
    resolveExtensions: [".fs", ".js", ".mjs", ".cjs", ".json"],
    plugins: [fsLoaderPlugin()],
    loader: { ".fs": "js" },
  });
}

export async function runBuild() {
  if (!existsSync(PAGES_DIR)) throw new Error("Missing app/pages directory. Run: fastscript create app");

  rmSync(DIST_DIR, { recursive: true, force: true });
  mkdirSync(DIST_DIR, { recursive: true });

  const manifest = { routes: [], apiRoutes: [], layout: null, notFound: null, middleware: null };
  const pageFiles = walk(PAGES_DIR).filter((f) => [".js", ".fs"].includes(extname(f)));

  for (const file of pageFiles) {
    const rel = relative(APP_DIR, file).replace(/\\/g, "/");
    const relModule = rel.replace(/\.fs$/, ".js");
    const relFromPages = relative(PAGES_DIR, file).replace(/\\/g, "/").replace(/\.(js|fs)$/, "");
    const out = join(DIST_DIR, relModule);

    await compileFile(file, out, "browser");

    if (relFromPages === "_layout") manifest.layout = `./${relModule}`;
    else if (relFromPages === "404") manifest.notFound = `./${relModule}`;
    else if (!relFromPages.startsWith("_")) manifest.routes.push({ path: routeFromPageFile(file), module: `./${relModule}` });
  }

  if (existsSync(API_DIR)) {
    const apiFiles = walk(API_DIR).filter((f) => [".js", ".fs"].includes(extname(f)));
    for (const file of apiFiles) {
      const rel = relative(APP_DIR, file).replace(/\\/g, "/");
      const relModule = rel.replace(/\.fs$/, ".js");
      const out = join(DIST_DIR, relModule);
      await compileFile(file, out, "node");
      manifest.apiRoutes.push({ path: routeFromApiFile(file), module: `./${relModule}` });
    }
  }

  const middlewareSource = [join(APP_DIR, "middleware.fs"), join(APP_DIR, "middleware.js")].find((p) => existsSync(p));
  if (middlewareSource) {
    const rel = relative(APP_DIR, middlewareSource).replace(/\\/g, "/").replace(/\.fs$/, ".js");
    const out = join(DIST_DIR, rel);
    await compileFile(middlewareSource, out, "node");
    manifest.middleware = `./${rel}`;
  }

  const stylesSrc = join(APP_DIR, "styles.css");
  if (existsSync(stylesSrc)) copyFileSync(stylesSrc, join(DIST_DIR, "styles.css"));

  writeFileSync(join(DIST_DIR, "fastscript-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  writeFileSync(join(DIST_DIR, "router.js"), buildRouterRuntime(), "utf8");
  writeFileSync(join(DIST_DIR, "index.html"), buildIndexHtml(existsSync(stylesSrc)), "utf8");

  console.log(`built FastScript app with ${manifest.routes.length} page route(s) and ${manifest.apiRoutes.length} api route(s)`);
}

function buildIndexHtml(hasStyles) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FastScript</title>
    ${hasStyles ? '<link rel="stylesheet" href="/styles.css" />' : ""}
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/router.js"></script>
  </body>
</html>`;
}

function buildRouterRuntime() {
  return `
const app = document.getElementById("app");
const manifest = await fetch("/fastscript-manifest.json").then((r) => r.json());

function match(routePath, pathname) {
  const a = routePath.split("/").filter(Boolean);
  const b = pathname.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = b[i];
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

function findRoute(pathname) {
  for (const route of manifest.routes) {
    const params = match(route.path, pathname);
    if (params) return { route, params };
  }
  return null;
}

async function hydrate(mod, ctx) {
  if (typeof mod.hydrate === "function") {
    await mod.hydrate({ ...ctx, root: app });
  }
}

async function render(pathname, force = false) {
  const path = pathname || "/";
  const ssr = globalThis.__FASTSCRIPT_SSR;
  const initialHit = ssr && ssr.pathname === path;

  const matched = findRoute(path);
  let mod = null;
  let params = {};
  let data = {};
  let html = "";

  if (matched) {
    params = matched.params;
    mod = await import(matched.route.module);
  }

  if (initialHit && !force) {
    html = app.innerHTML;
    if (ssr?.data) data = ssr.data;
  } else if (!matched && manifest.notFound) {
    const nfMod = await import(manifest.notFound);
    html = (nfMod.default ? nfMod.default({ pathname: path }) : "<h1>404</h1>") || "";
  } else if (matched) {
    if (typeof mod.load === "function") data = (await mod.load({ params, pathname: path })) || {};
    html = (mod.default ? mod.default({ ...data, params, pathname: path }) : "") || "";
    if (manifest.layout) {
      const layout = await import(manifest.layout);
      html = layout.default ? layout.default({ content: html, pathname: path }) : html;
    }
    app.innerHTML = html;
  }

  bindLinks();
  if (mod) await hydrate(mod, { pathname: path, params, data });
  globalThis.__FASTSCRIPT_SSR = null;
}

function bindLinks() {
  for (const a of app.querySelectorAll('a[href^="/"]')) {
    if (a.dataset.fsBound === "1") continue;
    a.dataset.fsBound = "1";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const href = a.getAttribute("href");
      history.pushState({}, "", href);
      render(location.pathname, true);
    });
  }
}

window.addEventListener("popstate", () => render(location.pathname, true));
render(location.pathname, false);
`;
}

