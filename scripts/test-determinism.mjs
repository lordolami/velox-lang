import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runBuild } from "../src/build.mjs";

const distDir = resolve("dist");

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

function distFingerprint() {
  const hash = createHash("sha256");
  const files = walk(distDir);
  for (const file of files) {
    const rel = file.slice(distDir.length + 1).replace(/\\/g, "/");
    hash.update(rel);
    hash.update("\n");
    hash.update(readFileSync(file));
    hash.update("\n");
  }
  return hash.digest("hex");
}

await runBuild();
const first = distFingerprint();
await runBuild();
const second = distFingerprint();

assert.equal(first, second, "Build output must be deterministic across sequential builds");
console.log(`test-determinism pass: ${first.slice(0, 12)}`);

