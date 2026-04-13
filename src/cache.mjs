import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function createMemoryCache() {
  const m = new Map();
  return {
    async get(key) {
      const row = m.get(key);
      if (!row) return null;
      if (row.exp && row.exp < Date.now()) {
        m.delete(key);
        return null;
      }
      return row.value;
    },
    async set(key, value, ttlMs = 0) {
      m.set(key, { value, exp: ttlMs ? Date.now() + ttlMs : 0 });
    },
    async del(key) { m.delete(key); },
    async clear() { m.clear(); },
  };
}

export function createFileCache({ dir = ".fastscript/cache" } = {}) {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });
  const p = (key) => join(root, `${encodeURIComponent(key)}.json`);
  return {
    async get(key) {
      const file = p(key);
      if (!existsSync(file)) return null;
      const row = JSON.parse(readFileSync(file, "utf8"));
      if (row.exp && row.exp < Date.now()) { rmSync(file, { force: true }); return null; }
      return row.value;
    },
    async set(key, value, ttlMs = 0) {
      writeFileSync(p(key), JSON.stringify({ value, exp: ttlMs ? Date.now() + ttlMs : 0 }), "utf8");
    },
    async del(key) { rmSync(p(key), { force: true }); },
    async clear() { rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true }); },
  };
}

export async function createRedisCache({ url = process.env.REDIS_URL } = {}) {
  const mod = await import("redis");
  const client = mod.createClient({ url });
  await client.connect();
  return {
    async get(key) { return client.get(key); },
    async set(key, value, ttlMs = 0) {
      if (ttlMs > 0) await client.set(key, value, { PX: ttlMs });
      else await client.set(key, value);
    },
    async del(key) { await client.del(key); },
    async clear() { await client.flushDb(); },
    async close() { await client.quit(); },
  };
}
