import { createHmac, timingSafeEqual } from "node:crypto";

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

export async function verifyWebhookRequest(req, { secret, signatureHeader = "x-signature", timestampHeader = "x-timestamp", maxSkewSec = 300 } = {}) {
  const raw = await readRawBody(req);
  const sig = req.headers[signatureHeader];
  const ts = req.headers[timestampHeader];
  if (isReplay(ts, maxSkewSec)) return { ok: false, reason: "replay_window" };
  if (!verifySignature(raw, Array.isArray(sig) ? sig[0] : sig, secret)) return { ok: false, reason: "bad_signature" };
  return { ok: true, raw };
}
