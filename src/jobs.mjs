import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

export function createJobQueue({ dir = ".fastscript" } = {}) {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });
  const path = join(root, "jobs.json");
  const state = readJson(path, { jobs: [] });

  function persist() { writeJson(path, state); }

  return {
    enqueue(name, payload = {}, opts = {}) {
      const now = Date.now();
      const delayMs = opts.delayMs ?? 0;
      const job = {
        id: randomUUID(),
        name,
        payload,
        runAt: now + delayMs,
        attempts: 0,
        maxAttempts: opts.maxAttempts ?? 3,
        backoffMs: opts.backoffMs ?? 250,
        repeatEveryMs: opts.repeatEveryMs ?? 0,
      };
      state.jobs.push(job);
      persist();
      return job;
    },
    peekReady(limit = 10) {
      const now = Date.now();
      return state.jobs.filter((j) => j.runAt <= now).slice(0, limit);
    },
    ack(id) {
      state.jobs = state.jobs.filter((j) => j.id !== id);
      persist();
    },
    fail(job) {
      const idx = state.jobs.findIndex((j) => j.id === job.id);
      if (idx < 0) return;
      const current = state.jobs[idx];
      current.attempts += 1;
      if (current.attempts >= current.maxAttempts) {
        state.jobs.splice(idx, 1);
      } else {
        current.runAt = Date.now() + current.backoffMs * current.attempts;
      }
      persist();
    },
    list() {
      return [...state.jobs];
    },
  };
}

export async function loadJobHandlers({ root = process.cwd() } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const jobsDir = path.join(root, "app", "jobs");
  const handlers = new Map();
  if (!fs.existsSync(jobsDir)) return handlers;
  const files = fs.readdirSync(jobsDir).filter((f) => /\.(js|mjs|cjs)$/.test(f));
  for (const file of files) {
    if (file === "schedules.js") continue;
    const full = path.join(jobsDir, file).replace(/\\/g, "/");
    const mod = await import(`${new URL(`file://${full}`).href}?t=${Date.now()}`);
    const name = mod.name || file.replace(/\.(js|mjs|cjs)$/, "");
    const handle = mod.handle || mod.default;
    if (typeof handle === "function") handlers.set(name, handle);
  }
  return handlers;
}

export async function loadSchedules({ root = process.cwd() } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const file = path.join(root, "app", "jobs", "schedules.js");
  if (!fs.existsSync(file)) return [];
  const mod = await import(`${new URL(`file://${file.replace(/\\/g, "/")}`).href}?t=${Date.now()}`);
  return mod.schedules || mod.default || [];
}

export async function runWorker({ dir = ".fastscript", pollMs = 350 } = {}) {
  const queue = createJobQueue({ dir });
  const handlers = await loadJobHandlers();
  const schedules = await loadSchedules();

  for (const s of schedules) {
    if (!s || !s.name) continue;
    const exists = queue.list().some((j) => j.name === s.name && j.runAt > Date.now());
    if (!exists) queue.enqueue(s.name, s.payload || {}, { delayMs: s.everyMs ?? 1000, maxAttempts: s.maxAttempts ?? 3, repeatEveryMs: s.everyMs ?? 0 });
  }

  console.log(`worker started: handlers=${handlers.size}`);
  const timer = setInterval(async () => {
    const jobs = queue.peekReady(20);
    for (const job of jobs) {
      const handle = handlers.get(job.name);
      if (!handle) {
        queue.fail(job);
        continue;
      }
      try {
        await handle(job.payload, { queue });
        if (job.repeatEveryMs > 0) {
          queue.enqueue(job.name, job.payload, { delayMs: job.repeatEveryMs, maxAttempts: job.maxAttempts, backoffMs: job.backoffMs, repeatEveryMs: job.repeatEveryMs });
        }
        queue.ack(job.id);
      } catch {
        queue.fail(job);
      }
    }
  }, pollMs);

  process.on("SIGINT", () => { clearInterval(timer); process.exit(0); });
  process.on("SIGTERM", () => { clearInterval(timer); process.exit(0); });
}
