import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, watch } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runBuild } from "./build.mjs";
import { parseCookies, serializeCookie, createSessionManager, requireUser } from "./auth.mjs";
import { createFileDatabase } from "./db.mjs";
import { composeMiddleware } from "./middleware.mjs";
import { readJsonBody, validateShape } from "./validation.mjs";
import { loadEnv, validateAppEnv } from "./env.mjs";
import { createLogger } from "./logger.mjs";
import { createJobQueue } from "./jobs.mjs";
import { securityHeaders, rateLimit, csrf } from "./security.mjs";
import { createFileCache } from "./cache.mjs";
import { createTracer } from "./observability.mjs";
import { createLocalStorage } from "./storage.mjs";

const DIST_DIR = resolve("dist");
const DB_DIR = resolve(".fastscript");

function contentType(path) {
  const ext = extname(path);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".map") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function readManifest() {
  const path = join(DIST_DIR, "fastscript-manifest.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

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

function resolveRoute(routes, pathname) {
  for (const route of routes) {
    const params = match(route.path, pathname);
    if (params) return { route, params };
  }
  return null;
}

async function importDist(modulePath) {
  const abs = join(DIST_DIR, modulePath.replace(/^\.\//, ""));
  const url = `${pathToFileURL(abs).href}?t=${Date.now()}`;
  return import(url);
}

function createHelpers(res) {
  return {
    json(body, status = 200, headers = {}) {
      return { status, json: body, headers };
    },
    text(body, status = 200, headers = {}) {
      return { status, body, headers };
    },
    redirect(location, status = 302) {
      return { status, headers: { location } };
    },
    setCookie(name, value, opts = {}) {
      const current = res.getHeader("set-cookie");
      const next = serializeCookie(name, value, opts);
      if (!current) res.setHeader("set-cookie", [next]);
      else res.setHeader("set-cookie", Array.isArray(current) ? [...current, next] : [String(current), next]);
    },
  };
}

function writeResponse(res, payload) {
  if (!payload) {
    res.writeHead(204);
    res.end();
    return;
  }
  const status = payload.status ?? 200;
  const headers = payload.headers ?? {};
  if (payload.cookies && payload.cookies.length) headers["set-cookie"] = payload.cookies;
  if (payload.json !== undefined) {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
    res.end(JSON.stringify(payload.json));
    return;
  }
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(payload.body ?? "");
}

function htmlDoc(content, ssrData, hasStyles) {
  const safe = JSON.stringify(ssrData ?? {}).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FastScript</title>
    ${hasStyles ? '<link rel="stylesheet" href="/styles.css" />' : ""}
  </head>
  <body>
    <div id="app">${content}</div>
    <script>window.__FASTSCRIPT_SSR=${safe}</script>
    <script type="module" src="/router.js"></script>
  </body>
</html>`;
}

export async function runServer({ mode = "development", watchMode = false, buildOnStart = true, port = 4173 } = {}) {
  loadEnv({ mode });
  await validateAppEnv();

  const logger = createLogger({ service: "fastscript-server" });
  const tracer = createTracer({ service: "fastscript-server" });
  if (buildOnStart) await runBuild();

  const sessions = createSessionManager({ dir: DB_DIR, cookieName: "fs_session", secret: process.env.SESSION_SECRET || "fastscript-dev-secret" });
  const db = createFileDatabase({ dir: DB_DIR, name: "appdb" });
  const queue = createJobQueue({ dir: DB_DIR });
  const cache = createFileCache({ dir: join(DB_DIR, "cache") });
  const storage = createLocalStorage({ dir: join(DB_DIR, "storage") });

  if (watchMode) {
    let timer = null;
    watch(resolve("app"), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await runBuild();
          logger.info("rebuild complete");
        } catch (error) {
          logger.error("rebuild failed", { error: error.message });
        }
      }, 120);
    });
  }

  const server = createServer(async (req, res) => {
    const requestId = logger.requestId();
    const start = Date.now();
    const span = tracer.span("request", { requestId, path: req.url, method: req.method });
    res.setHeader("x-request-id", requestId);

    try {
      const url = new URL(req.url || "/", "http://localhost");
      const pathname = url.pathname;
      const manifest = readManifest();
      const helpers = createHelpers(res);
      const cookies = parseCookies(req.headers.cookie || "");
      const session = sessions.read(cookies[sessions.cookieName]);
      sessions.sweepExpired();

      const ctx = {
        req,
        res,
        requestId,
        pathname,
        method: (req.method || "GET").toUpperCase(),
        params: {},
        query: Object.fromEntries(url.searchParams.entries()),
        cookies,
        user: session?.user ?? null,
        db,
        queue,
        cache,
        storage,
        auth: {
          login: (user, opts = {}) => {
            const token = sessions.create(user, opts.maxAge ?? 60 * 60 * 24 * 7);
            helpers.setCookie(sessions.cookieName, token, { path: "/", httpOnly: true, maxAge: opts.maxAge ?? 60 * 60 * 24 * 7 });
            return token;
          },
          logout: () => {
            sessions.delete(cookies[sessions.cookieName]);
            helpers.setCookie(sessions.cookieName, "", { path: "/", httpOnly: true, maxAge: 0 });
          },
          requireUser: () => requireUser(session?.user ?? null),
          rotate: (opts = {}) => {
            const token = sessions.rotate(cookies[sessions.cookieName], opts.maxAge ?? 60 * 60 * 24 * 7);
            if (token) helpers.setCookie(sessions.cookieName, token, { path: "/", httpOnly: true, maxAge: opts.maxAge ?? 60 * 60 * 24 * 7 });
            return token;
          },
        },
        input: {
          body: null,
          query: Object.fromEntries(url.searchParams.entries()),
          async readJson() {
            if (ctx.input.body !== null) return ctx.input.body;
            ctx.input.body = await readJsonBody(req);
            return ctx.input.body;
          },
          validateQuery(schema) {
            return validateShape(schema, ctx.query, "query").value;
          },
          async validateBody(schema) {
            const body = await ctx.input.readJson();
            return validateShape(schema, body, "body").value;
          },
        },
        helpers,
      };

      const isBodyMethod = !["GET", "HEAD"].includes(ctx.method);
      const contentTypeHeader = String(req.headers["content-type"] || "");
      if (isBodyMethod && contentTypeHeader.includes("application/json")) {
        ctx.input.body = await ctx.input.readJson();
      }

      const target = join(DIST_DIR, pathname === "/" ? "index.html" : pathname.slice(1));
      if (pathname.startsWith("/__storage/")) {
        const key = pathname.slice("/__storage/".length);
        const file = storage.get(key);
        if (!file) {
          writeResponse(res, { status: 404, body: "Not found" });
          span.end({ status: 404, kind: "storage" });
          return;
        }
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.end(file);
        span.end({ status: 200, kind: "storage" });
        return;
      }
      if (existsSync(target) && statSync(target).isFile() && !pathname.endsWith(".html")) {
        const body = readFileSync(target);
        res.writeHead(200, { "content-type": contentType(target) });
        res.end(body);
        logger.info("static", { requestId, path: pathname, status: 200, ms: Date.now() - start });
        span.end({ status: 200, kind: "static" });
        return;
      }

      const middlewareList = [];
      middlewareList.push(securityHeaders(), rateLimit());
      if (process.env.CSRF_PROTECT === "1") middlewareList.push(csrf());
      if (manifest.middleware) {
        const mm = await importDist(manifest.middleware);
        if (Array.isArray(mm.middlewares)) middlewareList.push(...mm.middlewares);
        else if (typeof mm.middleware === "function") middlewareList.push(mm.middleware);
        else if (typeof mm.default === "function") middlewareList.push(mm.default);
      }
      const runWithMiddleware = composeMiddleware(middlewareList);

      const out = await runWithMiddleware(ctx, async () => {
        if (pathname.startsWith("/api/")) {
          const apiHit = resolveRoute(manifest.apiRoutes, pathname);
          if (!apiHit) return { status: 404, body: "API route not found" };
          ctx.params = apiHit.params;
          const mod = await importDist(apiHit.route.module);
          const handler = mod[ctx.method];
          if (typeof handler !== "function") return { status: 405, body: `Method ${ctx.method} not allowed` };
          if (mod.schemas?.[ctx.method]) {
            ctx.input.body = await ctx.input.readJson();
            validateShape(mod.schemas[ctx.method], ctx.input.body, "body");
          }
          return handler(ctx, helpers);
        }

        const hit = resolveRoute(manifest.routes, pathname);
        if (!hit) {
          if (manifest.notFound) {
            const nfMod = await importDist(manifest.notFound);
            const body = nfMod.default ? nfMod.default({ pathname }) : "<h1>404</h1>";
            return { status: 404, html: body, data: null };
          }
          return { status: 404, body: "Not found" };
        }

        ctx.params = hit.params;
        const mod = await importDist(hit.route.module);

        if (!["GET", "HEAD"].includes(ctx.method) && typeof mod[ctx.method] === "function") {
          if (mod.schemas?.[ctx.method]) {
            ctx.input.body = await ctx.input.readJson();
            validateShape(mod.schemas[ctx.method], ctx.input.body, "body");
          }
          return mod[ctx.method](ctx, helpers);
        }

        let data = {};
        if (typeof mod.load === "function") data = (await mod.load({ ...ctx, params: hit.params, pathname })) || {};
        let html = mod.default ? mod.default({ ...data, params: hit.params, pathname, user: ctx.user }) : "";

        if (manifest.layout) {
          const layout = await importDist(manifest.layout);
          html = layout.default ? layout.default({ content: html, pathname, user: ctx.user }) : html;
        }

        return { status: 200, html, data };
      });

      if (out?.html !== undefined) {
        const hasStyles = existsSync(join(DIST_DIR, "styles.css"));
        const payload = { pathname, data: out.data ?? null };
        res.writeHead(out.status ?? 200, { "content-type": "text/html; charset=utf-8" });
        res.end(htmlDoc(out.html, payload, hasStyles));
        logger.info("ssr", { requestId, path: pathname, status: out.status ?? 200, ms: Date.now() - start });
        span.end({ status: out.status ?? 200, kind: "ssr" });
        return;
      }

      writeResponse(res, out);
      logger.info("response", { requestId, path: pathname, status: out?.status ?? 200, ms: Date.now() - start });
      span.end({ status: out?.status ?? 200, kind: "response" });
    } catch (error) {
      const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
      const payload = {
        ok: false,
        error: {
          message: error?.message || "Unknown error",
          status,
          details: error?.details || null,
        },
      };
      const wantsJson = (req.headers.accept || "").includes("application/json") || (req.url || "").startsWith("/api/");
      if (wantsJson) {
        res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(payload));
      } else {
        res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
        res.end(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Error</title><style>body{background:#050505;color:#fff;font:16px/1.6 ui-sans-serif,system-ui;padding:40px}code{color:#9f92ff}</style></head><body><h1>Something went wrong</h1><p>Please retry or roll back to the previous deploy.</p><p>Request ID: <code>${requestId}</code></p></body></html>`);
      }
      logger.error("request_error", { requestId, status, path: req.url, error: payload.error.message });
      span.end({ status, error: payload.error.message, kind: "error" });
    }
  });

  server.listen(port, () => {
    logger.info("server_started", { mode, port, watchMode });
  });
}
