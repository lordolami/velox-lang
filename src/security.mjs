import { createHash } from "node:crypto";

const rateState = new Map();

export function securityHeaders({ csp = "default-src 'self'", hsts = "max-age=31536000; includeSubDomains" } = {}) {
  return async function securityHeadersMiddleware(ctx, next) {
    ctx.res.setHeader("x-content-type-options", "nosniff");
    ctx.res.setHeader("x-frame-options", "DENY");
    ctx.res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    ctx.res.setHeader("permissions-policy", "geolocation=(), microphone=(), camera=()");
    ctx.res.setHeader("content-security-policy", csp);
    if ((process.env.NODE_ENV || "development") === "production") {
      ctx.res.setHeader("strict-transport-security", hsts);
    }
    return next();
  };
}

export function rateLimit({ windowMs = 60_000, max = 120, key = (ctx) => ctx.req.socket.remoteAddress || "anon" } = {}) {
  return async function rateLimitMiddleware(ctx, next) {
    const k = key(ctx);
    const now = Date.now();
    const row = rateState.get(k) || { count: 0, resetAt: now + windowMs };
    if (now > row.resetAt) {
      row.count = 0;
      row.resetAt = now + windowMs;
    }
    row.count += 1;
    rateState.set(k, row);
    ctx.res.setHeader("x-ratelimit-limit", String(max));
    ctx.res.setHeader("x-ratelimit-remaining", String(Math.max(0, max - row.count)));
    if (row.count > max) {
      return { status: 429, json: { ok: false, error: "rate_limited" }, headers: { "retry-after": String(Math.ceil((row.resetAt - now) / 1000)) } };
    }
    return next();
  };
}

export function csrf({ cookieName = "fs_csrf", headerName = "x-csrf-token" } = {}) {
  return async function csrfMiddleware(ctx, next) {
    const method = ctx.method || "GET";
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      const token = ctx.cookies[cookieName] || createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex");
      ctx.helpers.setCookie(cookieName, token, { path: "/", sameSite: "Lax" });
      return next();
    }
    const cookie = ctx.cookies[cookieName];
    const header = ctx.req.headers[headerName];
    const token = Array.isArray(header) ? header[0] : header;
    if (!cookie || !token || cookie !== token) {
      return { status: 403, json: { ok: false, error: "csrf_invalid" } };
    }
    return next();
  };
}
