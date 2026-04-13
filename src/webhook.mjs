import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function signPayload(payload, secret, algo = "sha256") {
  const mac = createHmac(algo, secret).update(payload).digest("hex");
  return `${algo}=${mac}`;
}

export function verifySignature(payload, header, secret, algo = "sha256") {
  if (!header || typeof header !== "string") return false;
  const expected = signPayload(payload, secret, algo);
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isReplay(tsSeconds, maxSkewSec = 300) {
  const ts = Number(tsSeconds);
  if (!Number.isFinite(ts)) return true;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) > maxSkewSec;
}

function replayStore({ dir = ".fastscript", ttlSec = 600 } = {}) {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });
  const file = join(root, "webhook-replay.json");
  let state = { seen: {} };
  if (existsSync(file)) {
    try { state = JSON.parse(readFileSync(file, "utf8")); } catch {}
  }
  function persist() {
    writeFileSync(file, JSON.stringify(state, null, 2), "utf8");
  }
  return {
    has(id) {
      const now = Date.now();
      for (const [k, exp] of Object.entries(state.seen)) if (exp < now) delete state.seen[k];
      persist();
      return Boolean(state.seen[id]);
    },
    add(id) {
      state.seen[id] = Date.now() + ttlSec * 1000;
      persist();
    },
  };
}

export async function verifyWebhookRequest(req, { secret, signatureHeader = "x-signature", timestampHeader = "x-timestamp", idHeader = "x-event-id", maxSkewSec = 300, replayDir = ".fastscript" } = {}) {
  const raw = await readRawBody(req);
  const sig = req.headers[signatureHeader];
  const ts = req.headers[timestampHeader];
  const eventId = req.headers[idHeader];
  const id = Array.isArray(eventId) ? eventId[0] : eventId;
  if (isReplay(ts, maxSkewSec)) return { ok: false, reason: "replay_window" };
  if (!verifySignature(raw, Array.isArray(sig) ? sig[0] : sig, secret)) return { ok: false, reason: "bad_signature" };
  if (id) {
    const store = replayStore({ dir: replayDir, ttlSec: Math.max(maxSkewSec, 600) });
    if (store.has(id)) return { ok: false, reason: "duplicate_event" };
    store.add(id);
  }
  return { ok: true, raw };
}
