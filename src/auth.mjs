import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export function serializeCookie(name, value, opts = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`];
  bits.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly !== false) bits.push("HttpOnly");
  if (opts.sameSite) bits.push(`SameSite=${opts.sameSite}`);
  else bits.push("SameSite=Lax");
  if (opts.secure) bits.push("Secure");
  if (typeof opts.maxAge === "number") bits.push(`Max-Age=${opts.maxAge}`);
  return bits.join("; ");
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionManager({ dir = ".fastscript", cookieName = "fs_session", secret = "fastscript-dev-secret" } = {}) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "sessions.json");
  const state = readJson(path, { sessions: {} });

  function persist() {
    writeJson(path, state);
  }

  return {
    cookieName,
    sweepExpired() {
      let removed = 0;
      const now = Date.now();
      for (const [id, row] of Object.entries(state.sessions)) {
        if (!row || row.exp < now) {
          delete state.sessions[id];
          removed += 1;
        }
      }
      if (removed) persist();
      return removed;
    },
    create(user, maxAgeSec = 60 * 60 * 24 * 7) {
      const id = randomBytes(12).toString("hex");
      const exp = Date.now() + maxAgeSec * 1000;
      state.sessions[id] = { user, exp };
      persist();
      const sig = sign(`${id}.${exp}`, secret);
      return `${id}.${exp}.${sig}`;
    },
    read(token) {
      if (!token) return null;
      const [id, expStr, sig] = token.split(".");
      if (!id || !expStr || !sig) return null;
      const expected = sign(`${id}.${expStr}`, secret);
      if (expected !== sig) return null;
      const exp = Number(expStr);
      if (!Number.isFinite(exp) || exp < Date.now()) return null;
      const row = state.sessions[id];
      if (!row || row.exp < Date.now()) {
        if (row) {
          delete state.sessions[id];
          persist();
        }
        return null;
      }
      return row;
    },
    delete(token) {
      const [id] = String(token || "").split(".");
      if (!id) return;
      delete state.sessions[id];
      persist();
    },
    rotate(token, maxAgeSec = 60 * 60 * 24 * 7) {
      const row = this.read(token);
      if (!row?.user) return null;
      this.delete(token);
      return this.create(row.user, maxAgeSec);
    },
  };
}

export function requireUser(user) {
  if (!user) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
  return user;
}
