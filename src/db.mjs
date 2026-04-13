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

export function createFileDatabase({ dir = ".fastscript", name = "appdb" } = {}) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.json`);
  const state = readJson(path, { collections: {} });

  function persist() {
    writeJson(path, state);
  }

  function ensureCollection(collection) {
    if (!state.collections[collection]) state.collections[collection] = {};
    return state.collections[collection];
  }

  return {
    collection(name) {
      return {
        get(id) {
          const col = ensureCollection(name);
          return col[id] ?? null;
        },
        set(id, value) {
          const col = ensureCollection(name);
          col[id] = value;
          persist();
          return col[id];
        },
        delete(id) {
          const col = ensureCollection(name);
          delete col[id];
          persist();
        },
        all() {
          const col = ensureCollection(name);
          return Object.values(col);
        },
        upsert(id, updater) {
          const col = ensureCollection(name);
          const prev = col[id] ?? null;
          const next = typeof updater === "function" ? updater(prev) : updater;
          col[id] = next;
          persist();
          return next;
        },
        first(predicate) {
          const col = ensureCollection(name);
          return Object.values(col).find(predicate) ?? null;
        },
        where(filters) {
          const col = ensureCollection(name);
          if (typeof filters === "function") return Object.values(col).filter(filters);
          return Object.values(col).filter((row) =>
            Object.entries(filters || {}).every(([k, v]) => row?.[k] === v),
          );
        },
      };
    },
    transaction(fn) {
      const snapshot = JSON.stringify(state);
      try {
        const res = fn(this);
        persist();
        return res;
      } catch (error) {
        const rollback = JSON.parse(snapshot);
        state.collections = rollback.collections ?? {};
        persist();
        throw error;
      }
    },
    query(collection, predicate) {
      const col = ensureCollection(collection);
      return Object.values(col).filter(predicate);
    },
    first(collection, predicate) {
      const col = ensureCollection(collection);
      return Object.values(col).find(predicate) ?? null;
    },
    where(collection, filters) {
      const col = ensureCollection(collection);
      if (typeof filters === "function") return Object.values(col).filter(filters);
      return Object.values(col).filter((row) =>
        Object.entries(filters || {}).every(([k, v]) => row?.[k] === v),
      );
    },
  };
}
